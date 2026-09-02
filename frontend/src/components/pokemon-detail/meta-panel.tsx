// F2 phases 2-3: tournament meta panel for the Pokemon detail page. Shows the
// Limitless usage% / team win rate / teammate cores and the Pikalytics per-battle
// win rate (both doubles). Sources are attributed inline as required. Renders
// nothing when there's no meta row for this species.

import { Link } from '@tanstack/react-router';
import type { PokemonMeta } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';

function pct(n: number | null): string {
    return n === null ? '-' : `${n.toFixed(1)}%`;
}

// Colour a win rate around the 50% break-even (>52 good, <48 poor).
function wrClass(n: number | null): string {
    if (n === null) return 'text-muted-foreground';
    if (n >= 52) return 'text-emerald-700 dark:text-emerald-300';
    if (n < 48) return 'text-destructive';
    return 'text-foreground';
}

export function MetaPanel({ meta }: { meta: PokemonMeta | null }) {
    const hasLimitless = meta?.limitlessUsagePct != null || meta?.limitlessTeamWinPct != null;
    const hasPika = meta?.pikalyticsWinPct != null;
    if (!meta || (!hasLimitless && !hasPika)) return null;

    return (
        <section className="rounded-md border p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Tournament meta</h2>
                <span className="text-xs text-muted-foreground">
                    doubles · Limitless
                    {hasPika && ' + Pikalytics'}
                    {meta.tournamentSampleDecklists ? ` · ${meta.tournamentSampleDecklists} decklists` : ''}
                    {meta.tournamentCount ? ` / ${meta.tournamentCount} events` : ''}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Usage" value={pct(meta.limitlessUsagePct)} hint="of tournament teams" />
                <Stat
                    label="Team win rate"
                    value={pct(meta.limitlessTeamWinPct)}
                    valueClass={wrClass(meta.limitlessTeamWinPct)}
                    hint="teams running it"
                />
                <Stat
                    label="Battle win rate"
                    value={pct(meta.pikalyticsWinPct)}
                    valueClass={wrClass(meta.pikalyticsWinPct)}
                    hint={meta.pikalyticsDataDate ? `Pikalytics ${meta.pikalyticsDataDate}` : 'Pikalytics'}
                />
                <Stat label="Sample" value={meta.limitlessDecklists != null ? `${meta.limitlessDecklists}` : '-'} hint="decklists w/ it" />
            </div>

            {meta.topTeammates.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top teammates</div>
                    <ul className="flex flex-wrap gap-2">
                        {meta.topTeammates.map((t, i) => (
                            <li key={i} className="flex items-center gap-1.5 rounded border bg-muted/20 px-2 py-1 text-xs">
                                {t.pokemonId ? (
                                    <Link to="/pokemon/$id" params={{ id: t.pokemonId }} className="flex items-center gap-1.5 hover:underline">
                                        <Sprite id={t.pokemonId} className="h-6 w-6" loading="lazy" decoding="async" />
                                        <span className="font-medium">{t.name}</span>
                                    </Link>
                                ) : (
                                    <span className="font-medium">{t.name}</span>
                                )}
                                <span className="tabular-nums text-muted-foreground">{t.pct.toFixed(0)}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-[11px] text-muted-foreground">
                Team win rate reflects records of whole teams that ran this Pokemon; battle win rate is per-Pokemon.
                {meta.pikalyticsRecord && ` Record ${meta.pikalyticsRecord}.`}
            </p>
        </section>
    );
}

function Stat({ label, value, hint, valueClass }: { label: string; value: string; hint?: string; valueClass?: string }) {
    return (
        <div className="flex flex-col gap-0.5 rounded border bg-muted/20 p-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className={`text-lg font-bold tabular-nums ${valueClass ?? ''}`}>{value}</span>
            {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        </div>
    );
}
