import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { getPokemonList, type PokemonListItem } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TypePill } from '@/components/type-pill';
import { TYPE_COLORS } from '@/lib/type-colors';
import { cn } from '@/lib/utils';

const TYPES = Object.keys(TYPE_COLORS);

interface Props {
    value: number | null;
    onChange: (id: number | null) => void;
}

export function PokemonPicker({ value, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [pcOnly, setPcOnly] = useState(true);
    const [typeFilter1, setTypeFilter1] = useState<string>('');
    const [typeFilter2, setTypeFilter2] = useState<string>('');

    const { data: pokemon } = useQuery({
        queryKey: ['pokemon'],
        queryFn: getPokemonList,
    });

    const selected = useMemo(
        () => pokemon?.find((p) => p.id === value) ?? null,
        [pokemon, value],
    );

    const options = useMemo(() => {
        if (!pokemon) return [] as PokemonListItem[];
        let rows = pcOnly ? pokemon.filter((p) => p.pcAvailable) : pokemon;

        // Dual-type filter: when both set, pokemon must have BOTH types
        // (in any order). Same value picked in both fields collapses to a
        // single-type filter via dedupe.
        const wantedTypes = Array.from(new Set([typeFilter1, typeFilter2].filter(Boolean)));
        if (wantedTypes.length > 0) {
            rows = rows.filter((p) => {
                const ts = [p.type1, p.type2].filter((t): t is string => Boolean(t));
                return wantedTypes.every((w) => ts.includes(w));
            });
        }
        return rows;
    }, [pokemon, pcOnly, typeFilter1, typeFilter2]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selected ? (
                        <span className="flex items-center gap-2 truncate">
                            <Sprite id={selected.id} className="h-6 w-6" />
                            <span className="truncate">{selected.displayName}</span>
                            <TypePill name={selected.type1} className="text-[10px]" />
                            {selected.type2 && <TypePill name={selected.type2} className="text-[10px]" />}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">Pick a Pokemon…</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
                <Command
                    filter={(value, search) => {
                        // Custom filter: match on displayName (cmdk lowercases the value).
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }}
                >
                    <CommandInput placeholder="Search by name…" />
                    <div className="border-b px-3 py-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Select
                                value={typeFilter1 || '__any'}
                                onValueChange={(v) => setTypeFilter1(v === '__any' ? '' : v)}
                            >
                                <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__any">Any type</SelectItem>
                                    {TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            <span className="flex items-center gap-1.5">
                                                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[t].bg }} />
                                                {t}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-[10px] text-muted-foreground">+</span>
                            <Select
                                value={typeFilter2 || '__any'}
                                onValueChange={(v) => setTypeFilter2(v === '__any' ? '' : v)}
                            >
                                <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__any">Any type</SelectItem>
                                    {TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            <span className="flex items-center gap-1.5">
                                                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[t].bg }} />
                                                {t}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <Checkbox
                                checked={pcOnly}
                                onCheckedChange={(v) => setPcOnly(v === true)}
                            />
                            PC-available only
                        </label>
                    </div>
                    <CommandList>
                        <CommandEmpty>No Pokemon found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((p) => (
                                <CommandItem
                                    key={p.id}
                                    value={`${p.displayName} ${p.type1} ${p.type2 ?? ''}`}
                                    onSelect={() => {
                                        onChange(p.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Sprite id={p.id} className="h-7 w-7" loading="lazy" />
                                    <span className="flex-1 truncate">{p.displayName}</span>
                                    <span className="flex items-center gap-1">
                                        <TypePill name={p.type1} className="text-[10px]" />
                                        {p.type2 && <TypePill name={p.type2} className="text-[10px]" />}
                                    </span>
                                    {!p.pcAvailable && (
                                        <span className="text-[10px] text-muted-foreground">not in PC</span>
                                    )}
                                    <Check
                                        className={cn(
                                            'ml-1 h-4 w-4',
                                            value === p.id ? 'opacity-100' : 'opacity-0',
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
