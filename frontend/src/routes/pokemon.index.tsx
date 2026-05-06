import { useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { getPokemonList, type PokemonListItem } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { DexNumber } from '@/components/pokedex/dex-number';
import { LedPill } from '@/components/pokedex/led-pill';
import { PokedexDevice } from '@/components/pokedex/pokedex-device';
import { TypePill } from '@/components/type-pill';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { TYPE_COLORS } from '@/lib/type-colors';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/pokemon/')({
    component: PokemonPage,
});

const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', 'all'] as const;
type PageSizeOption = typeof PAGE_SIZE_OPTIONS[number];

function pageSizeLabel(opt: PageSizeOption): string {
    return opt === 'all' ? 'All' : opt;
}

const TYPES = Object.keys(TYPE_COLORS);
const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface StatRange {
    min: string; // string so empty inputs don't fight controlled-number quirks
    max: string;
}
const EMPTY_RANGE: StatRange = { min: '', max: '' };
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst'] as const;
type StatKey = typeof STAT_KEYS[number];
const STAT_LABELS: Record<StatKey, string> = {
    hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', bst: 'BST',
};

function inRange(value: number, range: StatRange): boolean {
    if (range.min !== '' && value < Number(range.min)) return false;
    if (range.max !== '' && value > Number(range.max)) return false;
    return true;
}

function rangeActive(range: StatRange): boolean {
    return range.min !== '' || range.max !== '';
}

function TypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <Select
            value={value || '__any'}
            onValueChange={(v) => onChange(v === '__any' ? '' : v)}
        >
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="__any">Any</SelectItem>
                {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                            <span
                                className="inline-block h-3 w-3 rounded-sm"
                                style={{ backgroundColor: TYPE_COLORS[t].bg }}
                                aria-hidden
                            />
                            {t}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function AbilityFilterPicker({
    value,
    onChange,
    options,
    selected,
}: {
    value: number | null;
    onChange: (id: number | null) => void;
    options: ReadonlyArray<{ id: number; displayName: string }>;
    selected: { id: number; displayName: string } | null;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between font-normal"
                >
                    {selected ? (
                        <span className="truncate">{selected.displayName}</span>
                    ) : (
                        <span className="text-muted-foreground">Any ability</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search abilities…" />
                    <CommandList>
                        <CommandEmpty>No abilities match.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="__any any-ability"
                                onSelect={() => { onChange(null); setOpen(false); }}
                            >
                                <span className="flex-1 italic text-muted-foreground">Any ability</span>
                                <Check className={cn('ml-1 h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')} />
                            </CommandItem>
                            {options.map((a) => (
                                <CommandItem
                                    key={a.id}
                                    value={a.displayName}
                                    onSelect={() => { onChange(a.id); setOpen(false); }}
                                >
                                    <span className="flex-1 truncate">{a.displayName}</span>
                                    <Check className={cn('ml-1 h-4 w-4', value === a.id ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function PokemonPage() {
    const navigate = useNavigate();
    const { data, isLoading, error } = useQuery({
        queryKey: ['pokemon'],
        queryFn: getPokemonList,
    });

    const [search, setSearch] = useState('');
    const [pcOnly, setPcOnly] = useState(false);
    const [typeFilter1, setTypeFilter1] = useState<string>('');         // '' = any
    const [typeFilter2, setTypeFilter2] = useState<string>('');         // '' = any (paired with typeFilter1, must both match)
    const [abilityId, setAbilityId] = useState<number | null>(null);    // null = any
    const [generation, setGeneration] = useState<string>('');           // '' = any, otherwise '1'..'9'
    const [megaOnly, setMegaOnly] = useState(false);
    const [regionalOnly, setRegionalOnly] = useState(false);
    const [showStatFilters, setShowStatFilters] = useState(false);
    const [statRanges, setStatRanges] = useState<Record<StatKey, StatRange>>({
        hp: { ...EMPTY_RANGE }, atk: { ...EMPTY_RANGE }, def: { ...EMPTY_RANGE },
        spa: { ...EMPTY_RANGE }, spd: { ...EMPTY_RANGE }, spe: { ...EMPTY_RANGE },
        bst: { ...EMPTY_RANGE },
    });
    const [pageSize, setPageSize] = useState<PageSizeOption>('50');
    const [page, setPage] = useState(1);

    const total = data?.length ?? 0;

    // Unique abilities across the dataset, sorted alphabetically. Derived from
    // the cached list so the picker doesn't need its own endpoint.
    const allAbilities = useMemo(() => {
        if (!data) return [] as Array<{ id: number; displayName: string }>;
        const seen = new Map<number, string>();
        for (const p of data) {
            for (const a of p.abilities) {
                if (!seen.has(a.id)) seen.set(a.id, a.displayName);
            }
        }
        return Array.from(seen, ([id, displayName]) => ({ id, displayName }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [data]);

    const selectedAbility = useMemo(
        () => abilityId !== null ? allAbilities.find((a) => a.id === abilityId) ?? null : null,
        [allAbilities, abilityId],
    );

    const filtered = useMemo<PokemonListItem[]>(() => {
        let rows = data ?? [];
        if (pcOnly) rows = rows.filter((p) => p.pcAvailable);
        if (megaOnly) rows = rows.filter((p) => p.isMega);
        if (regionalOnly) rows = rows.filter((p) => p.isRegional);

        const q = search.trim().toLowerCase();
        if (q) rows = rows.filter((p) => p.displayName.toLowerCase().includes(q));

        // Type filter — both fields contribute, deduplicated. With two types
        // selected, the pokemon must carry both (in any slot). With one
        // selected, we keep the single-type behaviour.
        const wantedTypes = Array.from(new Set([typeFilter1, typeFilter2].filter(Boolean)));
        if (wantedTypes.length > 0) {
            rows = rows.filter((p) => {
                const pokemonTypes = [p.type1, p.type2].filter((t): t is string => Boolean(t));
                return wantedTypes.every((t) => pokemonTypes.includes(t));
            });
        }
        if (abilityId !== null) {
            rows = rows.filter((p) => p.abilities.some((a) => a.id === abilityId));
        }
        if (generation) {
            const gen = Number(generation);
            rows = rows.filter((p) => p.generation === gen);
        }

        // Stat range filters — only apply ranges that have at least one bound.
        const activeRanges = STAT_KEYS.filter((k) => rangeActive(statRanges[k]));
        if (activeRanges.length > 0) {
            rows = rows.filter((p) =>
                activeRanges.every((k) => inRange(
                    k === 'bst' ? p.stats.bst : p.stats[k],
                    statRanges[k],
                )),
            );
        }

        return rows;
    }, [data, pcOnly, megaOnly, regionalOnly, search, typeFilter1, typeFilter2, abilityId, generation, statRanges]);

    const filteredCount = filtered.length;
    const effectivePageSize = pageSize === 'all' ? Math.max(filteredCount, 1) : parseInt(pageSize, 10);
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredCount / effectivePageSize));
    const currentPage = Math.min(page, totalPages);
    const startIdx = (currentPage - 1) * effectivePageSize;
    const visibleRows = filtered.slice(startIdx, startIdx + effectivePageSize);

    const resetPage = () => setPage(1);

    const filtersActive = pcOnly || megaOnly || regionalOnly
        || search.trim() !== ''
        || typeFilter1 !== '' || typeFilter2 !== ''
        || abilityId !== null
        || generation !== ''
        || STAT_KEYS.some((k) => rangeActive(statRanges[k]));

    const clearFilters = () => {
        setSearch(''); setPcOnly(false); setMegaOnly(false); setRegionalOnly(false);
        setTypeFilter1(''); setTypeFilter2(''); setAbilityId(null); setGeneration('');
        setStatRanges({
            hp: { ...EMPTY_RANGE }, atk: { ...EMPTY_RANGE }, def: { ...EMPTY_RANGE },
            spa: { ...EMPTY_RANGE }, spd: { ...EMPTY_RANGE }, spe: { ...EMPTY_RANGE },
            bst: { ...EMPTY_RANGE },
        });
        resetPage();
    };

    const meta = data
        ? (filtersActive
            ? `${visibleRows.length} / ${filteredCount} of ${total}`
            : `${total} entries`)
        : '';

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <PokedexDevice title="Pokédex" meta={meta}>
            <div className="flex flex-col gap-4">
            {filtersActive && (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={clearFilters}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Clear all filters
                    </Button>
                </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Search by name</label>
                    <Input
                        type="search"
                        value={search}
                        placeholder="Charizard, Garchomp, …"
                        onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                        className="w-[220px]"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                        Types <span className="text-[10px] italic">(both required if set)</span>
                    </label>
                    <div className="flex items-center gap-1">
                        <TypeSelect value={typeFilter1} onChange={(v) => { setTypeFilter1(v); resetPage(); }} />
                        <span className="text-xs text-muted-foreground">+</span>
                        <TypeSelect value={typeFilter2} onChange={(v) => { setTypeFilter2(v); resetPage(); }} />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Ability</label>
                    <AbilityFilterPicker
                        value={abilityId}
                        onChange={(id) => { setAbilityId(id); resetPage(); }}
                        options={allAbilities}
                        selected={selectedAbility}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Generation</label>
                    <Select
                        value={generation || '__any'}
                        onValueChange={(v) => { setGeneration(v === '__any' ? '' : v); resetPage(); }}
                    >
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__any">Any gen</SelectItem>
                            {GENERATIONS.map((g) => (
                                <SelectItem key={g} value={String(g)}>Gen {g}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Page size</label>
                    <Select
                        value={pageSize}
                        onValueChange={(v) => { setPageSize(v as PageSizeOption); resetPage(); }}
                    >
                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((o) => (
                                <SelectItem key={o} value={o}>{pageSizeLabel(o)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
                    <Checkbox
                        checked={pcOnly}
                        onCheckedChange={(v) => { setPcOnly(v === true); resetPage(); }}
                    />
                    <span className="text-sm">PC-available only</span>
                </label>
                <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
                    <Checkbox
                        checked={megaOnly}
                        onCheckedChange={(v) => { setMegaOnly(v === true); resetPage(); }}
                    />
                    <span className="text-sm">Mega forms only</span>
                </label>
                <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
                    <Checkbox
                        checked={regionalOnly}
                        onCheckedChange={(v) => { setRegionalOnly(v === true); resetPage(); }}
                    />
                    <span className="text-sm">Regional variants only</span>
                </label>

                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setShowStatFilters((v) => !v)}
                    className="self-end"
                >
                    {showStatFilters ? 'Hide stat filters' : 'More filters'}
                    {STAT_KEYS.some((k) => rangeActive(statRanges[k])) && (
                        <span className="ml-1.5 rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                            {STAT_KEYS.filter((k) => rangeActive(statRanges[k])).length}
                        </span>
                    )}
                </Button>
            </div>

            {showStatFilters && (
                <div className="rounded-md border p-3 grid grid-cols-1 gap-2 md:grid-cols-7">
                    {STAT_KEYS.map((k) => (
                        <div key={k} className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">
                                {STAT_LABELS[k]}
                            </label>
                            <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    placeholder="min"
                                    value={statRanges[k].min}
                                    onChange={(e) => {
                                        setStatRanges((r) => ({ ...r, [k]: { ...r[k], min: e.target.value } }));
                                        resetPage();
                                    }}
                                    className="h-8 px-1 text-center text-xs tabular-nums"
                                />
                                <span className="text-xs text-muted-foreground">–</span>
                                <Input
                                    type="number"
                                    placeholder="max"
                                    value={statRanges[k].max}
                                    onChange={(e) => {
                                        setStatRanges((r) => ({ ...r, [k]: { ...r[k], max: e.target.value } }));
                                        resetPage();
                                    }}
                                    className="h-8 px-1 text-center text-xs tabular-nums"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isLoading && <p className="text-muted-foreground">Loading…</p>}
            {error && (
                <p className="text-destructive">
                    {error instanceof Error ? error.message : 'Failed to load pokemon'}
                </p>
            )}

            {data && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px] text-right">#</TableHead>
                                    <TableHead className="w-[56px]"></TableHead>
                                    <TableHead className="min-w-[180px]">Name</TableHead>
                                    <TableHead className="min-w-[180px]">Types</TableHead>
                                    <TableHead className="text-center">HP</TableHead>
                                    <TableHead className="text-center">ATK</TableHead>
                                    <TableHead className="text-center">DEF</TableHead>
                                    <TableHead className="text-center">SPA</TableHead>
                                    <TableHead className="text-center">SPD</TableHead>
                                    <TableHead className="text-center">SPE</TableHead>
                                    <TableHead className="text-center font-semibold">BST</TableHead>
                                    <TableHead className="text-center">Gen</TableHead>
                                    <TableHead className="min-w-[160px]">Tags</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleRows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={13} className="text-center text-muted-foreground py-6">
                                            No matching pokemon.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {visibleRows.map((p) => (
                                    <TableRow
                                        key={p.id}
                                        onClick={() => navigate({ to: '/pokemon/$id', params: { id: p.id } })}
                                        className="cursor-pointer"
                                    >
                                        <TableCell className="text-right">
                                            <DexNumber id={p.id} className="text-xs" />
                                        </TableCell>
                                        <TableCell className="p-1">
                                            <Sprite
                                                id={p.id}
                                                width={48}
                                                height={48}
                                                loading="lazy"
                                                decoding="async"
                                                className={cn('h-12 w-12', !p.pcAvailable && 'opacity-60')}
                                            />
                                        </TableCell>
                                        <TableCell className={cn('font-medium', !p.pcAvailable && 'opacity-60')}>
                                            {p.displayName}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1">
                                                <TypePill name={p.type1} />
                                                {p.type2 && <TypePill name={p.type2} />}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">{p.stats.hp}</TableCell>
                                        <TableCell className="text-center tabular-nums">{p.stats.atk}</TableCell>
                                        <TableCell className="text-center tabular-nums">{p.stats.def}</TableCell>
                                        <TableCell className="text-center tabular-nums">{p.stats.spa}</TableCell>
                                        <TableCell className="text-center tabular-nums">{p.stats.spd}</TableCell>
                                        <TableCell className="text-center tabular-nums">{p.stats.spe}</TableCell>
                                        <TableCell className="text-center tabular-nums font-semibold">
                                            {p.stats.bst}
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground tabular-nums">
                                            {p.generation ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {p.isMega && (
                                                    <span className="dossier-foil rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                                        Mega
                                                    </span>
                                                )}
                                                {p.isRegional && (
                                                    <LedPill variant="region">{p.regionVariant ?? 'Regional'}</LedPill>
                                                )}
                                                {!p.pcAvailable && (
                                                    <LedPill variant="off">Not in PC</LedPill>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            )}
            </div>
            </PokedexDevice>
        </section>
    );
}
