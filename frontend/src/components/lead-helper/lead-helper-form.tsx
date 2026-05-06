import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
    getPokemonList,
    getTypeChart,
    type TeamDetail,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { PokemonPicker } from '@/components/pickers/pokemon-picker';
import { TypePill } from '@/components/type-pill';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { rankRecommendations, type Recommendation } from './scoring';
import { cn } from '@/lib/utils';

interface Props {
    team: TeamDetail;
}

export function LeadHelperForm({ team }: Props) {
    const [opponentIds, setOpponentIds] = useState<Array<number | null>>([null, null, null, null, null, null]);
    const [showAll, setShowAll] = useState(false);

    const { data: pokemonList } = useQuery({ queryKey: ['pokemon'], queryFn: getPokemonList });
    const { data: typeChart } = useQuery({ queryKey: ['types', 'chart'], queryFn: getTypeChart });

    const opponents = useMemo(() => {
        if (!pokemonList) return [];
        return opponentIds
            .filter((id): id is number => id !== null)
            .map((id) => pokemonList.find((p) => p.id === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined);
    }, [pokemonList, opponentIds]);

    const recommendations = useMemo(() => {
        if (!typeChart || opponents.length === 0 || team.members.length < 4) return [];
        return rankRecommendations(team.members, opponents, typeChart);
    }, [team.members, opponents, typeChart]);

    const top = recommendations.slice(0, showAll ? 10 : 3);

    // For the tooltip's "% of best in this set", rescale every candidate's
    // total to a 0-100 value relative to the worst/best in the current
    // ranking. The raw score is unbounded, so this gives a stable readout.
    const scoreBounds = useMemo(() => {
        if (recommendations.length === 0) return { min: 0, max: 0 };
        const totals = recommendations.map((r) => r.scores.total);
        return { min: Math.min(...totals), max: Math.max(...totals) };
    }, [recommendations]);
    const percentOfBest = (score: number) => {
        const { min, max } = scoreBounds;
        if (max === min) return 100;
        return Math.round(((score - min) / (max - min)) * 100);
    };

    const setOpponentAt = (i: number, id: number | null) => {
        setOpponentIds((prev) => prev.map((v, j) => (j === i ? id : v)));
    };

    const filledCount = opponentIds.filter((id) => id !== null).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-md border p-4 flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                    <h3 className="dossier-eyebrow">
                        Opponent's 6
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {filledCount} / 6 picked
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Type the species you saw at team preview. Order doesn't matter, only the set of 6. No items, abilities, or moves needed; defaults to STAB types and neutral speeds.
                </p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {opponentIds.map((id, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground w-6">{i + 1}.</span>
                            <div className="flex-1">
                                <PokemonPicker value={id} onChange={(next) => setOpponentAt(i, next)} />
                            </div>
                            {id !== null && (
                                <Button variant="ghost" size="icon" type="button" onClick={() => setOpponentAt(i, null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {opponents.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                    Pick at least one opposing Pokemon to compute recommendations.
                </div>
            ) : recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members to recommend from.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between">
                        <h3 className="dossier-eyebrow">
                            Top picks
                        </h3>
                        <span className="text-xs text-muted-foreground">
                            Showing top {top.length} of {recommendations.length} combinations
                        </span>
                    </div>
                    <ol className="flex flex-col gap-2">
                        {top.map((rec, i) => (
                            <RecommendationCard
                                key={`${rec.bringIds.join(',')}-${rec.leadIds.join(',')}`}
                                rec={rec}
                                rank={i + 1}
                                percentOfBest={percentOfBest(rec.scores.total)}
                            />
                        ))}
                    </ol>
                    <Button variant="outline" size="sm" type="button" onClick={() => setShowAll((v) => !v)} className="self-start">
                        {showAll ? 'Show top 3 only' : 'Show top 10'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function RecommendationCard({
    rec, rank, percentOfBest,
}: { rec: Recommendation; rank: number; percentOfBest: number }) {
    const isLead = (id: number) => rec.leadIds.includes(id);

    return (
        <li className={cn(
            'rounded-md border p-3 flex flex-col gap-2',
            rec.hardBlocked && 'opacity-50 grayscale',
            rank === 1 && 'border-emerald-400 dark:border-emerald-700',
        )}>
            <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    rank === 1 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-muted text-muted-foreground',
                )}>
                    #{rank}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bring
                </span>
                <span className="flex flex-wrap items-center gap-1">
                    {rec.bring.map((m) => (
                        <span
                            key={m.id}
                            title={m.pokemon.displayName}
                            className={cn(
                                'flex h-10 w-10 items-center justify-center rounded',
                                isLead(m.id) ? 'bg-orange-100 ring-2 ring-orange-400 dark:bg-orange-900/40 dark:ring-orange-500'
                                    : 'bg-muted/30',
                            )}
                        >
                            <Sprite
                                id={m.pokemon.id}
                                alt={m.pokemon.displayName}
                                className="h-9 w-9"
                            />
                        </span>
                    ))}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2">
                    Lead
                </span>
                <span className="flex items-center gap-1">
                    {rec.lead.map((m) => (
                        <span key={m.id} className="text-sm font-medium">
                            {m.pokemon.displayName}
                        </span>
                    )).flatMap((el, i) => i === 0 ? [el] : [<span key={`sep-${i}`} className="text-muted-foreground">+</span>, el])}
                </span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="ml-auto rounded bg-muted px-2 py-0.5 text-xs tabular-nums cursor-help">
                            score {rec.scores.total}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px] text-xs">
                        <div className="font-semibold mb-1">
                            Score {rec.scores.total} <span className="text-muted-foreground">·</span> {percentOfBest}% of best
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-2">
                            Higher is better. Relative ranking, not capped to 100. The percent is rescaled across the 90-candidate set (worst = 0%, best = 100%).
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
                            <span className="text-muted-foreground">Offensive (SE coverage)</span>
                            <span className="text-right">{rec.scores.offensive >= 0 ? '+' : ''}{rec.scores.offensive}</span>
                            <span className="text-muted-foreground">Defensive (worst matchup)</span>
                            <span className="text-right">{rec.scores.defensive >= 0 ? '+' : ''}{rec.scores.defensive}</span>
                            <span className="text-muted-foreground">Speed (outsped pairs)</span>
                            <span className="text-right">+{rec.scores.speed}</span>
                            <span className="text-muted-foreground">Bonuses (Fake Out / Intim / Tailwind)</span>
                            <span className="text-right">+{rec.scores.bonuses}</span>
                            {rec.scores.penalties > 0 && (
                                <>
                                    <span className="text-destructive">Hard-rule penalty</span>
                                    <span className="text-right text-destructive">−{rec.scores.penalties}</span>
                                </>
                            )}
                            <span className="font-semibold">Total</span>
                            <span className="text-right font-semibold">{rec.scores.total >= 0 ? '+' : ''}{rec.scores.total}</span>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground tabular-nums">
                <span>Off: <span className="text-emerald-700 dark:text-emerald-300 font-medium">{rec.scores.offensive >= 0 ? '+' : ''}{rec.scores.offensive}</span></span>
                <span>Def: <span className={cn('font-medium', rec.scores.defensive >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>{rec.scores.defensive >= 0 ? '+' : ''}{rec.scores.defensive}</span></span>
                <span>Spd: <span className="text-foreground font-medium">+{rec.scores.speed}</span></span>
                {rec.scores.bonuses > 0 && (
                    <span>Bonus: <span className="text-emerald-700 dark:text-emerald-300 font-medium">+{rec.scores.bonuses}</span></span>
                )}
                {rec.scores.penalties > 0 && (
                    <span>Penalty: <span className="text-destructive font-medium">−{rec.scores.penalties}</span></span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {rec.bring[0] && (
                    <>
                        <TypePill name={rec.bring[0].pokemon.type1} className="text-[10px]" />
                        {rec.bring[0].pokemon.type2 && <TypePill name={rec.bring[0].pokemon.type2} className="text-[10px]" />}
                    </>
                )}
            </div>

            {rec.notes.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                    {rec.notes.map((n, i) => (
                        <li key={i} className={cn(
                            n.startsWith('🚫') && 'text-destructive font-medium',
                        )}>
                            • {n}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}
