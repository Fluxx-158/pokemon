import { useMemo, useState } from 'react';
import { createLazyFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import {
    getPokemonDetail,
    spriteUrl,
    type PokemonMoveEntry,
} from '@/modules/api/endpoints';
import { AbilityDescription } from '@/components/ability-description';
import { MoveClassIcon } from '@/components/move-class-icon';
import { MoveDescription } from '@/components/move-description';
import { TypePill } from '@/components/type-pill';
import { typeColor } from '@/lib/type-colors';
import { DexNumber } from '@/components/pokedex/dex-number';
import { LedPill } from '@/components/pokedex/led-pill';
import { PokedexDevice } from '@/components/pokedex/pokedex-device';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
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
import { capitalize, cn } from '@/lib/utils';

export const Route = createLazyFileRoute('/pokemon/$id')({
    component: PokemonDetailPage,
});

const STAT_ORDER: Array<{ key: keyof StatsKeys; label: string }> = [
    { key: 'hp', label: 'HP' },
    { key: 'atk', label: 'Atk' },
    { key: 'def', label: 'Def' },
    { key: 'spa', label: 'SpA' },
    { key: 'spd', label: 'SpD' },
    { key: 'spe', label: 'Spe' },
];

interface StatsKeys {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

function formatDelta(d: number): string {
    if (d > 0) return `+${d}`;
    if (d < 0) return `${d}`;
    return '±0';
}

const BASE_COLOR = '#1e293b';

interface StatsTooltipProps {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: { stat?: string; value?: number; base?: number | null } }>;
    megaName: string;
    baseName: string | null;
    showBase: boolean;
}

function StatsTooltip({ active, payload, megaName, baseName, showBase }: StatsTooltipProps) {
    if (!active || !payload?.length) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const value = entry.value;
    const base = entry.base;
    const showBaseRow = showBase && baseName !== null && typeof base === 'number';
    const delta = showBaseRow && typeof value === 'number' ? value - (base as number) : null;

    return (
        <div className="rounded-md border bg-background px-2.5 py-2 text-xs shadow-md">
            <div className="font-semibold mb-1">{entry.stat}</div>
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{megaName}:</span>
                <span className="font-semibold tabular-nums">{value}</span>
            </div>
            {showBaseRow && (
                <>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{baseName} (base):</span>
                        <span className="font-semibold tabular-nums">{base}</span>
                    </div>
                    <div className={cn(
                        'mt-1 tabular-nums',
                        (delta ?? 0) > 0 && 'text-emerald-600 dark:text-emerald-400',
                        (delta ?? 0) < 0 && 'text-red-600 dark:text-red-400',
                        (delta ?? 0) === 0 && 'text-muted-foreground',
                    )}>
                        Δ {formatDelta(delta ?? 0)}
                    </div>
                </>
            )}
        </div>
    );
}


function PokemonDetailPage() {
    const { id } = Route.useParams();

    const { data, isLoading, error } = useQuery({
        queryKey: ['pokemon', id],
        queryFn: () => getPokemonDetail(id),
    });

    const [moveSearch, setMoveSearch] = useState('');
    const [learnMethod, setLearnMethod] = useState<string>('all');
    const [compareBase, setCompareBase] = useState(true);

    const learnMethods = useMemo(() => {
        if (!data) return [] as string[];
        return Array.from(new Set(data.moves.map((m) => m.learnMethod))).sort();
    }, [data]);

    const filteredMoves = useMemo<PokemonMoveEntry[]>(() => {
        if (!data) return [];
        let rows = data.moves;
        if (learnMethod !== 'all') {
            rows = rows.filter((m) => m.learnMethod === learnMethod);
        }
        const q = moveSearch.trim().toLowerCase();
        if (q) {
            rows = rows.filter((m) => m.displayName.toLowerCase().includes(q));
        }
        // Default: alpha by name. When filtering to level-up, sort by level asc then name.
        if (learnMethod === 'level-up') {
            return [...rows].sort(
                (a, b) =>
                    a.levelLearnedAt - b.levelLearnedAt ||
                    a.displayName.localeCompare(b.displayName),
            );
        }
        return [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [data, learnMethod, moveSearch]);

    if (isLoading) {
        return <p className="px-6 py-4 text-muted-foreground">Loading…</p>;
    }
    if (error) {
        return (
            <p className="px-6 py-4 text-destructive">
                {error instanceof Error ? error.message : 'Failed to load pokemon'}
            </p>
        );
    }
    if (!data) return null;

    const radarColor = typeColor(data.type1).bg;
    const showCompare = compareBase && data.baseForm !== null;
    const statsData = STAT_ORDER.map(({ key, label }) => ({
        stat: label,
        value: data.stats[key],
        base: data.baseForm ? data.baseForm.stats[key] : null,
    }));

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div>
                <Link
                    to="/pokemon"
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    ← Back to list
                </Link>
            </div>

            <PokedexDevice
                title="Pokédex"
                meta={data.generation ? `ENTRY · GEN ${data.generation}` : 'ENTRY'}
            >
            <div className="flex flex-col gap-8">
            {/* Hero — official artwork sits inside the Pokédex "scanning window".
                Dex number callout + status LEDs are pinned to the window's corners. */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
                <div className="pokedex-window flex h-72 items-center justify-center">
                    <span className="pokedex-dex-badge">#{String(data.id).padStart(4, '0')}</span>
                    <div className="pokedex-led-stack">
                        {data.isMega && <LedPill variant="mega">Mega</LedPill>}
                        {data.isRegional && (
                            <LedPill variant="region">{data.regionVariant ?? 'Regional'}</LedPill>
                        )}
                        <LedPill variant={data.pcAvailable ? 'ok' : 'off'}>
                            {data.pcAvailable ? 'PC' : 'Not in PC'}
                        </LedPill>
                    </div>
                    <img
                        src={spriteUrl(data.id, 'official')}
                        alt={data.displayName}
                        className="relative z-[1] h-60 w-60 object-contain drop-shadow-md"
                        onError={(e) => {
                            // Fall back to default sprite if no official artwork.
                            const img = e.currentTarget as HTMLImageElement;
                            if (!img.dataset.fellBack) {
                                img.dataset.fellBack = '1';
                                img.src = spriteUrl(data.id, 'default');
                            } else {
                                img.style.visibility = 'hidden';
                            }
                        }}
                    />
                </div>
                <div className="flex flex-col gap-3">
                    <DexNumber id={data.id} className="pokedex-dex-number-large" />
                    <h1 className="text-3xl font-bold">{data.displayName}</h1>
                    <div className="flex flex-wrap gap-1.5">
                        <TypePill name={data.type1} />
                        {data.type2 && <TypePill name={data.type2} />}
                    </div>
                    {data.pcNotes && (
                        <p className="rounded border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            {data.pcNotes}
                        </p>
                    )}
                </div>
            </div>

            {/* Stats + Abilities */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-md border p-4">
                    <div className="mb-2 flex items-baseline justify-between">
                        <h2 className="text-lg font-semibold">Base stats</h2>
                        <span className="text-sm text-muted-foreground">
                            BST <span className="font-semibold tabular-nums text-foreground">{data.stats.bst}</span>
                            {showCompare && data.baseForm && (
                                <span className="ml-2 text-xs">
                                    (base {data.baseForm.stats.bst}, {formatDelta(data.stats.bst - data.baseForm.stats.bst)})
                                </span>
                            )}
                        </span>
                    </div>
                    {data.baseForm && (
                        <label className="mb-2 flex items-center gap-2 text-xs cursor-pointer select-none">
                            <Checkbox
                                checked={compareBase}
                                onCheckedChange={(v) => setCompareBase(v === true)}
                            />
                            <span>
                                Compare with base form <span className="text-muted-foreground">({data.baseForm.displayName})</span>
                            </span>
                        </label>
                    )}
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={statsData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="stat" tick={{ fontSize: 12 }} />
                                <PolarRadiusAxis angle={90} domain={[0, 255]} tick={{ fontSize: 10 }} />
                                <Radar
                                    name={data.displayName}
                                    dataKey="value"
                                    stroke={radarColor}
                                    strokeWidth={2}
                                    fill={radarColor}
                                    fillOpacity={0.45}
                                />
                                {showCompare && data.baseForm && (
                                    <Radar
                                        name={`${data.baseForm.displayName} (base)`}
                                        dataKey="base"
                                        stroke={BASE_COLOR}
                                        strokeWidth={2}
                                        fill={BASE_COLOR}
                                        fillOpacity={0.4}
                                        isAnimationActive={false}
                                    />
                                )}
                                <Tooltip
                                    cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                                    content={(props) => (
                                        <StatsTooltip
                                            {...props}
                                            megaName={data.displayName}
                                            baseName={data.baseForm?.displayName ?? null}
                                            showBase={showCompare}
                                        />
                                    )}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                    {showCompare && data.baseForm && (
                        <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span
                                    aria-hidden
                                    className="inline-block h-2.5 w-3.5 rounded-sm"
                                    style={{ backgroundColor: radarColor, opacity: 0.7 }}
                                />
                                {data.displayName}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    aria-hidden
                                    className="inline-block h-2.5 w-3.5 rounded-sm"
                                    style={{ backgroundColor: BASE_COLOR, opacity: 0.7 }}
                                />
                                {data.baseForm.displayName} (base)
                            </span>
                        </div>
                    )}
                    <div className="mt-2 grid grid-cols-6 gap-1 text-center text-xs">
                        {STAT_ORDER.map(({ key, label }) => {
                            const value = data.stats[key];
                            const base = data.baseForm?.stats[key];
                            const delta = base !== undefined ? value - base : null;
                            return (
                                <div key={key} className="flex flex-col">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-semibold tabular-nums">{value}</span>
                                    {showCompare && delta !== null && (
                                        <span className={cn(
                                            'tabular-nums text-[10px]',
                                            delta > 0 && 'text-emerald-600 dark:text-emerald-400',
                                            delta < 0 && 'text-red-600 dark:text-red-400',
                                            delta === 0 && 'text-muted-foreground',
                                        )}>
                                            {formatDelta(delta)}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="rounded-md border p-4">
                    <h2 className="mb-2 text-lg font-semibold">Abilities</h2>
                    {data.abilities.length === 0 && (
                        <p className="text-sm text-muted-foreground">No abilities.</p>
                    )}
                    <ul className="flex flex-col gap-2">
                        {data.abilities.map((a) => (
                            <li key={a.id} className="rounded border p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Popover>
                                        <PopoverTrigger className="font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:underline">
                                            {a.displayName}
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-80">
                                            <AbilityDescription
                                                displayName={a.displayName}
                                                shortEffect={a.shortEffect}
                                                effect={a.effect}
                                                isHidden={a.isHidden}
                                                pcNotes={a.pcNotes}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <span className="text-xs text-muted-foreground">
                                        Slot {a.slot}
                                    </span>
                                    {a.isHidden && (
                                        <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                                            Hidden
                                        </span>
                                    )}
                                    {a.pcChanged && (
                                        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                            PC-changed
                                        </span>
                                    )}
                                </div>
                                {a.shortEffect && (
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.shortEffect}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Mega evolutions */}
            {data.megaEvolutions.length > 0 && (
                <div className="rounded-md border p-4">
                    <h2 className="mb-2 text-lg font-semibold">Mega evolutions</h2>
                    <ul className="flex flex-col gap-2">
                        {data.megaEvolutions.map((me) => (
                            <li key={me.megaPokemonId} className="flex flex-wrap items-center gap-2 text-sm">
                                <Link
                                    to="/pokemon/$id"
                                    params={{ id: me.megaPokemonId }}
                                    className="font-semibold text-primary hover:underline"
                                >
                                    {me.megaPokemonDisplayName}
                                </Link>
                                <span className="text-muted-foreground">via</span>
                                <span>{me.megaStoneDisplayName}</span>
                                {!me.megaStonePcAvailable && (
                                    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                        Stone not in PC
                                    </span>
                                )}
                                {me.notes && (
                                    <span className="text-xs text-muted-foreground">({me.notes})</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Moves */}
            <div>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                    <h2 className="text-lg font-semibold">
                        Moves{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                            ({filteredMoves.length} of {data.moves.length})
                        </span>
                    </h2>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Search</label>
                        <Input
                            type="search"
                            value={moveSearch}
                            placeholder="Flamethrower, Earthquake, …"
                            onChange={(e) => setMoveSearch(e.target.value)}
                            className="w-[240px]"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Learn method</label>
                        <Select value={learnMethod} onValueChange={setLearnMethod}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All methods</SelectItem>
                                {learnMethods.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {m}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[180px]">Name</TableHead>
                                <TableHead className="min-w-[90px]">Type</TableHead>
                                <TableHead className="min-w-[90px]">Class</TableHead>
                                <TableHead className="text-center">Pow</TableHead>
                                <TableHead className="text-center">Acc</TableHead>
                                <TableHead className="text-center">PP</TableHead>
                                <TableHead className="text-center">Pri</TableHead>
                                <TableHead className="min-w-[140px]">Method</TableHead>
                                <TableHead className="text-center">Lv</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMoves.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                                        No matching moves.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredMoves.map((m) => (
                                <TableRow key={`${m.id}-${m.learnMethod}-${m.levelLearnedAt}`}>
                                    <TableCell className={cn('font-medium', !m.pcAvailable && 'opacity-60')}>
                                        <Popover>
                                            <PopoverTrigger
                                                className={cn(
                                                    'underline-offset-2 hover:underline focus:outline-none focus-visible:underline text-left',
                                                    !m.pcAvailable && 'line-through',
                                                )}
                                            >
                                                {m.displayName}
                                            </PopoverTrigger>
                                            <PopoverContent align="start" className="w-80">
                                                <MoveDescription
                                                    displayName={m.displayName}
                                                    type={m.type}
                                                    damageClass={m.damageClass}
                                                    power={m.power}
                                                    accuracy={m.accuracy}
                                                    ppPc={m.ppPc}
                                                    priority={m.priority}
                                                    effectChance={m.effectChance}
                                                    shortEffect={m.shortEffect}
                                                    effect={m.effect}
                                                    pcNotes={m.pcNotes}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </TableCell>
                                    <TableCell>
                                        <TypePill name={capitalize(m.type)} />
                                    </TableCell>
                                    <TableCell>
                                        <MoveClassIcon cls={m.damageClass} />
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums">{m.power ?? '—'}</TableCell>
                                    <TableCell className="text-center tabular-nums">
                                        {m.accuracy === null ? '—' : `${m.accuracy}%`}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums">{m.ppPc}</TableCell>
                                    <TableCell className="text-center tabular-nums">
                                        {m.priority === 0 ? '—' : (m.priority > 0 ? `+${m.priority}` : m.priority)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{m.learnMethod}</TableCell>
                                    <TableCell className="text-center tabular-nums">
                                        {m.learnMethod === 'level-up' ? m.levelLearnedAt : '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
            </div>
            </PokedexDevice>
        </section>
    );
}
