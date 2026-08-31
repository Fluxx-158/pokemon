// F3: meta-weighted partner-pick suggestions. Driven by AnalysisMembers +
// a resolved format so it works both from a saved team (Coverage tab) and the
// standalone analyzer.

import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getPartnerSuggestions } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { TypePill } from '@/components/type-pill';
import type { AnalysisMember } from '@/lib/team-analysis';
import { seasonLabel } from '@/lib/season';
import { UsageUnavailable } from '@/components/usage-unavailable';

export function PartnerSuggestions({ members, format }: { members: AnalysisMember[]; format: 'doubles' | 'singles' }) {
    const payload = members.map((m) => ({
        pokemonId: m.pokemonId,
        ability: m.ability,
        moveTypes: m.moves.filter((mv) => mv.power !== null).map((mv) => mv.type),
    }));

    const { data, isLoading, error } = useQuery({
        queryKey: ['partners', format, payload],
        queryFn: () => getPartnerSuggestions({ format, members: payload }),
        enabled: payload.length > 0,
    });

    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
                <h2 className="dossier-eyebrow">Suggested partners</h2>
                <span className="text-xs text-muted-foreground">
                    {seasonLabel(data?.sourceSeason)}meta-weighted · {format}
                    {data?.sourceGeneratedAt && ` · ${data.sourceGeneratedAt.slice(0, 10)}`}
                </span>
            </div>

            {data && data.weightedWeaknesses.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Biggest meta-weighted weaknesses:</span>
                    {data.weightedWeaknesses.slice(0, 5).map((w) => (
                        <span key={w.type} className="inline-flex items-center gap-1">
                            <TypePill name={w.type} className="text-[10px]" />
                            <span className="tabular-nums text-muted-foreground">×{w.weakCount}</span>
                        </span>
                    ))}
                </div>
            )}

            {isLoading && <p className="text-sm text-muted-foreground">Scoring candidates…</p>}
            {error && (
                <p className="text-sm text-destructive">
                    {error instanceof Error ? error.message : 'Failed to load suggestions'}
                </p>
            )}

            {/* No provenance stamp ⇒ never synced / offline. Distinct from a
                genuinely well-rounded team (which still has a source date). */}
            {data && !data.sourceGeneratedAt && !isLoading && (
                <UsageUnavailable what="Partner suggestions" />
            )}
            {data && data.sourceGeneratedAt && data.suggestions.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">
                    No standout partners, your coverage is already well-rounded for this format.
                </p>
            )}

            {data && data.suggestions.length > 0 && (
                <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {data.suggestions.map((s, i) => (
                        <li key={s.pokemonId} className="flex items-start gap-3 rounded border p-2.5">
                            <span className="mt-0.5 w-4 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                                {i + 1}
                            </span>
                            <Link to="/pokemon/$id" params={{ id: s.pokemonId }} className="shrink-0">
                                <Sprite id={s.pokemonId} className="h-12 w-12" loading="lazy" decoding="async" />
                            </Link>
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <div className="flex items-baseline gap-2">
                                    <Link to="/pokemon/$id" params={{ id: s.pokemonId }} className="font-semibold hover:underline">
                                        {s.displayName}
                                    </Link>
                                    {s.assumedAbility && (
                                        <span className="text-[10px] text-muted-foreground">assumes {s.assumedAbility}</span>
                                    )}
                                </div>
                                <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                                    {s.reasons.map((r, j) => (
                                        <li key={j} className="flex gap-1">
                                            <span className="text-emerald-600 dark:text-emerald-400">+</span>
                                            <span>{r}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
