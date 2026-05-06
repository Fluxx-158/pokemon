import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { getPokemonDetail, type PokemonMoveEntry } from '@/modules/api/endpoints';
import { MoveClassIcon } from '@/components/move-class-icon';
import { TypePill } from '@/components/type-pill';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { capitalize, cn } from '@/lib/utils';

interface Props {
    pokemonId: number | null;
    value: number | null;
    onChange: (moveId: number | null) => void;
    excludeMoveIds?: ReadonlyArray<number | null>; // already-selected slots, to grey them out
}

export function MovePicker({ pokemonId, value, onChange, excludeMoveIds = [] }: Props) {
    const [open, setOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['pokemon', pokemonId],
        queryFn: () => getPokemonDetail(pokemonId!),
        enabled: pokemonId !== null,
    });

    // Dedupe by move id — a single move can appear under multiple learn methods.
    const uniqueMoves = useMemo(() => {
        if (!data?.moves) return [] as PokemonMoveEntry[];
        const seen = new Map<number, PokemonMoveEntry>();
        for (const m of data.moves) {
            const existing = seen.get(m.id);
            // Prefer pc-available + level-up entries when collapsing duplicates.
            if (!existing
                || (m.pcAvailable && !existing.pcAvailable)
                || (m.learnMethod === 'level-up' && existing.learnMethod !== 'level-up')) {
                seen.set(m.id, m);
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [data]);

    const selected = useMemo(
        () => uniqueMoves.find((m) => m.id === value) ?? null,
        [uniqueMoves, value],
    );

    const excluded = new Set(excludeMoveIds.filter((id): id is number => id !== null && id !== value));

    if (pokemonId === null) {
        return (
            <Button type="button" variant="outline" disabled className="w-full justify-between font-normal text-muted-foreground">
                Pick a Pokemon first
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            'w-full justify-between font-normal',
                            selected && !selected.pcAvailable && 'line-through opacity-70',
                        )}
                        disabled={isLoading}
                    >
                        {selected ? (
                            <span className="flex items-center gap-2 truncate">
                                <MoveClassIcon cls={selected.damageClass} withTooltip={false} />
                                <span className="truncate">{selected.displayName}</span>
                                <TypePill name={capitalize(selected.type)} className="text-[10px]" />
                            </span>
                        ) : (
                            <span className="text-muted-foreground">{isLoading ? 'Loading…' : 'Pick a move…'}</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search moves…" />
                        <CommandList>
                            <CommandEmpty>No moves match.</CommandEmpty>
                            <CommandGroup>
                                {uniqueMoves.map((m) => {
                                    const isExcluded = excluded.has(m.id);
                                    return (
                                        <CommandItem
                                            key={m.id}
                                            value={`${m.displayName} ${m.type}`}
                                            onSelect={() => {
                                                if (isExcluded) return;
                                                onChange(m.id);
                                                setOpen(false);
                                            }}
                                            className={cn(
                                                'flex-col items-stretch gap-0.5',
                                                !m.pcAvailable && 'opacity-50',
                                                isExcluded && 'opacity-40 pointer-events-none',
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <MoveClassIcon cls={m.damageClass} withTooltip={false} />
                                                <span className={cn('flex-1 truncate', !m.pcAvailable && 'line-through')}>
                                                    {m.displayName}
                                                </span>
                                                <TypePill name={capitalize(m.type)} className="text-[10px]" />
                                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                                    {m.power ?? '—'}/{m.accuracy === null ? '—' : m.accuracy}/{m.ppPc}
                                                </span>
                                                {!m.pcAvailable && (
                                                    <span className="text-[10px] text-amber-700 dark:text-amber-300">
                                                        not in PC
                                                    </span>
                                                )}
                                                {isExcluded && (
                                                    <span className="text-[10px] text-muted-foreground">in another slot</span>
                                                )}
                                                <Check
                                                    className={cn(
                                                        'ml-1 h-4 w-4',
                                                        value === m.id ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                />
                                            </div>
                                            {m.shortEffect && (
                                                <span className="text-[11px] italic text-muted-foreground line-clamp-1 pl-7">
                                                    {m.shortEffect}
                                                </span>
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selected?.shortEffect && (
                <p className="text-[11px] italic text-muted-foreground line-clamp-2 px-1">
                    {selected.shortEffect}
                </p>
            )}
        </div>
    );
}
