// Auto-derived defensive/offensive analysis from team data + the type chart.
// Pure client-side, all from queries we already cache.

import { useQuery } from '@tanstack/react-query';
import {
    getTypeChart,
    type TeamDetail,
    type TeamMemberDetail,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { TypePill } from '@/components/type-pill';
import { capitalize, cn } from '@/lib/utils';

const ATTACKING_TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
    'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark',
    'Steel', 'Fairy',
] as const;

interface DefensiveCell { member: TeamMemberDetail; mult: number; }
interface OffensiveHit { member: TeamMemberDetail; moveDisplayName: string; moveType: string; mult: number; }

export function CoverageTab({ team }: { team: TeamDetail }) {
    const { data: typeChart } = useQuery({ queryKey: ['types', 'chart'], queryFn: getTypeChart });

    if (!typeChart) return <p className="text-sm text-muted-foreground">Loading type chart…</p>;
    if (team.members.length === 0) return <p className="text-sm text-muted-foreground">No team members yet.</p>;

    // Defensive matrix: for each attacking type, the multiplier each member takes.
    const defensive: Record<string, DefensiveCell[]> = {};
    for (const atk of ATTACKING_TYPES) {
        defensive[atk] = team.members.map((m) => {
            const t1 = capitalize(m.pokemon.type1);
            const t2 = m.pokemon.type2 ? capitalize(m.pokemon.type2) : null;
            const mult = (typeChart[atk]?.[t1] ?? 1) * (t2 ? (typeChart[atk]?.[t2] ?? 1) : 1);
            return { member: m, mult };
        });
    }

    // Offensive matrix: for each defending type, list damaging moves on the team
    // that hit ≥2× super-effective.
    const offensive: Record<string, OffensiveHit[]> = {};
    for (const def of ATTACKING_TYPES) {
        const hits: OffensiveHit[] = [];
        for (const m of team.members) {
            for (const mv of m.moves) {
                if (mv.power === null) continue;
                const mvType = capitalize(mv.type);
                const mult = typeChart[mvType]?.[def] ?? 1;
                if (mult > 1) {
                    hits.push({ member: m, moveDisplayName: mv.displayName, moveType: mvType, mult });
                }
            }
        }
        // Best multiplier first, then by member slot for stability.
        hits.sort((a, b) => b.mult - a.mult || a.member.slot - b.member.slot);
        offensive[def] = hits;
    }

    // Highlights: defensive holes (3+ members ≥2×) and offensive gaps (no SE).
    const defensiveHoles = ATTACKING_TYPES
        .map((t) => ({ type: t, count: defensive[t].filter((c) => c.mult >= 2).length }))
        .filter((x) => x.count >= 3)
        .sort((a, b) => b.count - a.count);
    const offensiveGaps = ATTACKING_TYPES.filter((t) => offensive[t].length === 0);
    const offensiveStrengths = ATTACKING_TYPES
        .map((t) => ({ type: t, count: offensive[t].length }))
        .filter((x) => x.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    return (
        <div className="flex flex-col gap-6">
            <CoverageHighlights
                defensiveHoles={defensiveHoles}
                offensiveGaps={offensiveGaps}
                offensiveStrengths={offensiveStrengths}
            />
            <DefensiveTable members={team.members} defensive={defensive} />
            <OffensiveTable offensive={offensive} />
        </div>
    );
}

function CoverageHighlights({
    defensiveHoles, offensiveGaps, offensiveStrengths,
}: {
    defensiveHoles: Array<{ type: string; count: number }>;
    offensiveGaps: string[];
    offensiveStrengths: Array<{ type: string; count: number }>;
}) {
    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <h2 className="dossier-eyebrow">Highlights</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                <HighlightCard
                    title="Defensive holes"
                    empty="No type threatens 3+ of your team"
                    items={defensiveHoles.map((h) => ({
                        key: h.type,
                        label: <TypePill name={h.type} className="text-[10px]" />,
                        right: <span className="text-destructive font-semibold">{h.count} weak</span>,
                    }))}
                />
                <HighlightCard
                    title="Offensive coverage gaps"
                    empty="Every type has SE coverage"
                    items={offensiveGaps.map((t) => ({
                        key: t,
                        label: <TypePill name={t} className="text-[10px]" />,
                        right: <span className="text-muted-foreground">no SE</span>,
                    }))}
                />
                <HighlightCard
                    title="Offensive strengths"
                    empty="No type is hit SE by 3+ moves"
                    items={offensiveStrengths.map((s) => ({
                        key: s.type,
                        label: <TypePill name={s.type} className="text-[10px]" />,
                        right: <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{s.count} hits</span>,
                    }))}
                />
            </div>
        </div>
    );
}

interface HighlightItem {
    key: string;
    label: React.ReactNode;
    right: React.ReactNode;
}

function HighlightCard({
    title, items, empty,
}: { title: string; items: HighlightItem[]; empty: string }) {
    return (
        <div className="rounded border bg-muted/30 p-3 flex flex-col gap-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
            {items.length === 0 ? (
                <span className="text-xs italic text-muted-foreground">{empty}</span>
            ) : (
                <ul className="flex flex-col gap-1">
                    {items.map((item) => (
                        <li key={item.key} className="flex items-center justify-between gap-2 text-xs">
                            {item.label}
                            {item.right}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function multClass(mult: number): string {
    if (mult === 0) return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    if (mult < 1) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    if (mult > 2) return 'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100';
    if (mult > 1) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    return 'text-muted-foreground';
}

function multLabel(mult: number): string {
    if (mult === 0) return '×0';
    if (mult === 0.25) return '¼';
    if (mult === 0.5) return '½';
    if (mult === 1) return '1×';
    if (mult === 2) return '2×';
    if (mult === 4) return '4×';
    return `${mult}×`;
}

function DefensiveTable({
    members, defensive,
}: { members: TeamMemberDetail[]; defensive: Record<string, DefensiveCell[]> }) {
    // Build a fast lookup: memberId → attackingType → multiplier.
    const byMember: Record<number, Record<string, number>> = {};
    for (const m of members) byMember[m.id] = {};
    for (const t of ATTACKING_TYPES) {
        for (const cell of defensive[t]) {
            byMember[cell.member.id][t] = cell.mult;
        }
    }
    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <h2 className="dossier-eyebrow">
                Defensive: what threatens you
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="border-b">
                            <th className="px-2 py-1.5 text-left font-semibold sticky left-0 bg-card z-10">Pokemon</th>
                            {ATTACKING_TYPES.map((t) => (
                                <th key={t} className="px-1 py-1.5 font-semibold text-center">
                                    <TypePill name={t} className="text-[10px]" />
                                </th>
                            ))}
                            <th className="px-2 py-1.5 text-center font-semibold">Weak to</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map((m) => {
                            const weakCount = ATTACKING_TYPES.filter((t) => (byMember[m.id][t] ?? 1) >= 2).length;
                            const verdictCls = weakCount >= 5 ? 'text-destructive font-semibold'
                                : weakCount >= 3 ? 'text-amber-700 dark:text-amber-300'
                                : 'text-muted-foreground';
                            return (
                                <tr key={m.id} className="border-b last:border-0">
                                    <td className="px-2 py-1 sticky left-0 bg-card z-10">
                                        <div className="flex items-center gap-2">
                                            <Sprite id={m.pokemon.id} className="h-7 w-7 shrink-0" />
                                            <span className="truncate font-medium">{m.pokemon.displayName}</span>
                                        </div>
                                    </td>
                                    {ATTACKING_TYPES.map((t) => {
                                        const mult = byMember[m.id][t] ?? 1;
                                        return (
                                            <td key={t} className="px-1 py-1 text-center">
                                                <span className={cn(
                                                    'inline-block min-w-[2rem] rounded px-1 py-0.5 tabular-nums',
                                                    multClass(mult),
                                                )}>
                                                    {multLabel(mult)}
                                                </span>
                                            </td>
                                        );
                                    })}
                                    <td className={cn('px-2 py-1 text-center tabular-nums', verdictCls)}>
                                        {weakCount === 0 ? '—' : weakCount}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function OffensiveTable({
    offensive,
}: { offensive: Record<string, OffensiveHit[]> }) {
    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <h2 className="dossier-eyebrow">
                Offensive: your SE coverage
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {ATTACKING_TYPES.map((t) => {
                    const hits = offensive[t];
                    return (
                        <div key={t} className="flex flex-col gap-1 rounded border p-2">
                            <div className="flex items-baseline justify-between">
                                <span className="text-xs text-muted-foreground">vs</span>
                                <TypePill name={t} className="text-[10px]" />
                                <span className={cn(
                                    'text-[10px] tabular-nums',
                                    hits.length === 0 ? 'text-muted-foreground italic' : 'text-emerald-700 dark:text-emerald-300',
                                )}>
                                    {hits.length === 0 ? 'no SE coverage' : `${hits.length} SE hit${hits.length === 1 ? '' : 's'}`}
                                </span>
                            </div>
                            {hits.length > 0 && (
                                <ul className="flex flex-col gap-0.5 text-[11px]">
                                    {hits.map((h) => (
                                        <li key={`${h.member.id}-${h.moveDisplayName}`} className="flex items-center gap-1.5 truncate">
                                            <span className={cn(
                                                'rounded px-1 text-[9px] tabular-nums font-semibold',
                                                h.mult >= 4 ? 'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
                                            )}>
                                                {multLabel(h.mult)}
                                            </span>
                                            <span className="font-medium truncate">{h.moveDisplayName}</span>
                                            <span className="text-muted-foreground truncate">({h.member.pokemon.displayName})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
