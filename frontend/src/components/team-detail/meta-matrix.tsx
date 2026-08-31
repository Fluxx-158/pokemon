// F5: meta matchup matrix. For each top meta Pokemon, shows whether the team
// can threaten it (carried SE move) and whether it has a safe answer (a member
// that takes neutral-or-less from its common attacking types), plus
// usage-weighted summary shares. Type-based v1 (no damage rolls yet).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { getMetaMons, type TypeChart } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { TypePill } from '@/components/type-pill';
import { buildMetaMatrix, type AnalysisMember, type MetaMatrixRow } from '@/lib/team-analysis';
import { cn } from '@/lib/utils';
import { seasonLabel } from '@/lib/season';
import { UsageUnavailable } from '@/components/usage-unavailable';

export function MetaMatrix({
    members, format, typeChart,
}: { members: AnalysisMember[]; format: 'doubles' | 'singles'; typeChart: TypeChart }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['meta-mons', format],
        queryFn: () => getMetaMons(format, 30),
    });

    const matrix = useMemo(
        () => (data ? buildMetaMatrix(members, data.mons, typeChart) : null),
        [data, members, typeChart],
    );

    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
                <h2 className="dossier-eyebrow">vs Meta matrix</h2>
                <span className="text-xs text-muted-foreground">
                    {seasonLabel(data?.sourceSeason)}top {data?.mons.length ?? 30} by usage · {format}
                    {data?.sourceGeneratedAt && ` · ${data.sourceGeneratedAt.slice(0, 10)}`}
                </span>
            </div>

            {data && data.mons.length === 0 && !isLoading && (
                <UsageUnavailable what="Meta matrix data" />
            )}

            {matrix && matrix.rows.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                    <Stat
                        label="Can't threaten"
                        pct={matrix.failToThreatenPct}
                        hint="usage-weighted share of the meta you have no super-effective move for"
                        bad
                    />
                    <Stat
                        label="No safe answer"
                        pct={matrix.noSafeAnswerPct}
                        hint="usage-weighted share with no member that resists its common attacks"
                        bad
                    />
                </div>
            )}

            {isLoading && <p className="text-sm text-muted-foreground">Loading meta…</p>}
            {error && (
                <p className="text-sm text-destructive">
                    {error instanceof Error ? error.message : 'Failed to load meta'}
                </p>
            )}

            {matrix && matrix.rows.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="px-2 py-1.5 text-left font-semibold">Meta Pokémon</th>
                                <th className="px-2 py-1.5 text-left font-semibold">Types</th>
                                <th className="px-2 py-1.5 text-left font-semibold">Can you threaten it?</th>
                                <th className="px-2 py-1.5 text-left font-semibold">Safe answer?</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.rows.map((row) => <Row key={row.mon.pokemonId} row={row} />)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Stat({ label, pct, hint, bad }: { label: string; pct: number; hint: string; bad?: boolean }) {
    const tone = pct >= 40 ? 'text-destructive' : pct >= 20 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300';
    return (
        <div className="rounded border bg-muted/30 p-3" title={hint}>
            <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                <span className={cn('text-lg font-bold tabular-nums', bad ? tone : 'text-foreground')}>{pct}%</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        </div>
    );
}

function Row({ row }: { row: MetaMatrixRow }) {
    return (
        <tr className="border-b last:border-0">
            <td className="px-2 py-1">
                <Link to="/pokemon/$id" params={{ id: row.mon.pokemonId }} className="flex items-center gap-2 hover:underline">
                    <Sprite id={row.mon.pokemonId} className="h-7 w-7 shrink-0" loading="lazy" decoding="async" />
                    <span className="truncate font-medium">{row.mon.displayName}</span>
                </Link>
            </td>
            <td className="px-2 py-1">
                <span className="inline-flex gap-1">
                    <TypePill name={row.mon.type1} className="text-[10px]" />
                    {row.mon.type2 && <TypePill name={row.mon.type2} className="text-[10px]" />}
                </span>
            </td>
            <td className="px-2 py-1">
                {row.threaten.can ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                        ✓ {row.threaten.viaMove}
                        <span className="text-muted-foreground"> ({row.threaten.viaMember})</span>
                    </span>
                ) : (
                    <span className="text-destructive">✗ no SE move</span>
                )}
            </td>
            <td className="px-2 py-1">
                {row.safe.has ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                        ✓ {row.safe.viaMember}
                    </span>
                ) : (
                    <span className="text-destructive">✗ none resists it</span>
                )}
            </td>
        </tr>
    );
}
