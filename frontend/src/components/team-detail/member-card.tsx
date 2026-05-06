import { Link } from '@tanstack/react-router';
import {
    type TeamMemberDetail,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { AbilityDescription } from '@/components/ability-description';
import { ItemDescription } from '@/components/item-description';
import { MoveClassIcon } from '@/components/move-class-icon';
import { MoveDescription } from '@/components/move-description';
import { TypePill } from '@/components/type-pill';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { capitalize, cn } from '@/lib/utils';

type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

const STAT_LABELS: Array<{ key: keyof TeamMemberDetail['evs']; label: string }> = [
    { key: 'hp', label: 'HP' },
    { key: 'atk', label: 'Atk' },
    { key: 'def', label: 'Def' },
    { key: 'spa', label: 'SpA' },
    { key: 'spd', label: 'SpD' },
    { key: 'spe', label: 'Spe' },
];

function statKeyShort(key: 'atk' | 'def' | 'spa' | 'spd' | 'spe'): string {
    switch (key) {
        case 'atk': return 'Atk';
        case 'def': return 'Def';
        case 'spa': return 'SpA';
        case 'spd': return 'SpD';
        case 'spe': return 'Spe';
    }
}

function statKeyLabel(key: StatKey): string {
    return STAT_LABELS.find((s) => s.key === key)?.label ?? key;
}

function NatureBadge({ effect }: { effect: TeamMemberDetail['natureEffect'] }) {
    if (!effect.plus && !effect.minus) {
        return <span className="ml-1 text-[10px] text-muted-foreground italic">(neutral)</span>;
    }
    return (
        <span className="ml-1 text-[10px] tabular-nums">
            {effect.plus && (
                <span className="rounded bg-emerald-100 px-1 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    +{statKeyShort(effect.plus)}
                </span>
            )}
            {effect.plus && effect.minus && <span className="mx-0.5 text-muted-foreground"> </span>}
            {effect.minus && (
                <span className="rounded bg-red-100 px-1 py-0.5 font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    −{statKeyShort(effect.minus)}
                </span>
            )}
        </span>
    );
}

function StatBreakdown({
    label, base, iv, ev, natureMod, isHp, final, natureName,
}: {
    label: string;
    base: number;
    iv: number;
    ev: number;
    natureMod: 1 | 1.1 | 0.9;
    isHp: boolean;
    final: number;
    natureName: string;
}) {
    const raw = Math.floor((2 * base + iv) * 50 / 100);
    const formula = isHp
        ? `floor((2×${base} + ${iv}) × 50/100) + 50 + 10 + ${ev}`
        : `floor((floor((2×${base} + ${iv}) × 50/100) + 5 + ${ev}) × ${natureMod})`;
    const intermediate = isHp
        ? `${raw} + 50 + 10 + ${ev}`
        : `floor((${raw} + 5 + ${ev}) × ${natureMod})`;
    const natureLabel =
        natureMod === 1.1 ? `${natureName} (+10% to ${label})`
        : natureMod === 0.9 ? `${natureName} (−10% to ${label})`
        : `${natureName} (no effect on ${label})`;

    return (
        <div className="flex flex-col gap-1.5 text-xs">
            <div className="font-semibold text-sm">{label}: {final}</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 tabular-nums">
                <span className="text-muted-foreground">Base</span><span>{base}</span>
                <span className="text-muted-foreground">IV</span><span>{iv}{!iv ? '' : iv === 31 ? ' (default)' : ''}</span>
                <span className="text-muted-foreground">EV</span><span>{ev}</span>
                <span className="text-muted-foreground">Nature</span><span>{natureLabel}</span>
            </div>
            <div className="rounded border bg-muted/40 px-2 py-1 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                {formula}{'\n= '}{intermediate}{'\n= '}{final}
            </div>
        </div>
    );
}

function StatCell({ member, statKey }: { member: TeamMemberDetail; statKey: StatKey }) {
    const base = member.pokemon.baseStats[statKey];
    const ev = member.evs[statKey];
    const iv = member.ivs ? member.ivs[statKey] : 31;
    const final = member.finalStats[statKey];
    const isHp = statKey === 'hp';
    const natureMod: 1.0 | 1.1 | 0.9 = !isHp && member.natureEffect.plus === statKey ? 1.1
        : !isHp && member.natureEffect.minus === statKey ? 0.9
        : 1.0;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="rounded bg-muted/30 px-1 py-1 font-semibold tabular-nums cursor-help">
                    {final}
                </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] p-3">
                <StatBreakdown
                    label={statKeyLabel(statKey)}
                    base={base}
                    iv={iv}
                    ev={ev}
                    natureMod={natureMod}
                    isHp={isHp}
                    final={final}
                    natureName={member.nature}
                />
            </TooltipContent>
        </Tooltip>
    );
}

function StatsGrid({ member }: { member: TeamMemberDetail }) {
    const rowLabel = 'text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-center';
    return (
        <div className="flex flex-col gap-1">
            <div
                className="grid gap-1 text-center text-xs"
                style={{ gridTemplateColumns: '88px repeat(6, minmax(0, 1fr))' }}
            >
                {/* Header row */}
                <div />
                {STAT_LABELS.map(({ key, label }) => (
                    <div key={`h-${key}`} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                    </div>
                ))}

                {/* Base row */}
                <div className={rowLabel}>Base</div>
                {STAT_LABELS.map(({ key }) => (
                    <div key={`b-${key}`} className="rounded bg-muted/30 px-1 py-1 tabular-nums">
                        {member.pokemon.baseStats[key as StatKey]}
                    </div>
                ))}

                {/* EVs invested row */}
                <div className={rowLabel}>EVs invested</div>
                {STAT_LABELS.map(({ key }) => {
                    const ev = member.evs[key];
                    return (
                        <div
                            key={`e-${key}`}
                            className={cn(
                                'rounded px-1 py-1 tabular-nums',
                                ev > 0
                                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {ev > 0 ? ev : '—'}
                        </div>
                    );
                })}

                {/* Final row */}
                <div className={rowLabel}>Final</div>
                {STAT_LABELS.map(({ key }) => (
                    <StatCell key={`f-${key}`} member={member} statKey={key as StatKey} />
                ))}
            </div>
        </div>
    );
}

export function MemberCard({ member }: { member: TeamMemberDetail }) {
    const isMegaHolder = member.item?.isMegaStone === true;

    return (
        <div className={cn(
            'p-4 flex flex-col gap-3',
            isMegaHolder ? 'dossier-foil-ring' : 'dossier-mat',
        )}>
            <div className="flex items-start gap-3">
                <Link
                    to="/pokemon/$id"
                    params={{ id: member.pokemon.id }}
                    className="flex h-20 w-20 items-center justify-center rounded bg-muted/30 hover:bg-accent/40 transition flex-shrink-0"
                >
                    <Sprite
                        id={member.pokemon.id}
                        alt={member.pokemon.displayName}
                        className="h-16 w-16"
                        decoding="async"
                    />
                </Link>

                <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">Slot {member.slot}</span>
                        <Link
                            to="/pokemon/$id"
                            params={{ id: member.pokemon.id }}
                            className="font-semibold hover:underline"
                        >
                            {member.pokemon.displayName}
                        </Link>
                        {isMegaHolder && (
                            <span className="dossier-foil rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                Mega holder
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <TypePill name={member.pokemon.type1} />
                        {member.pokemon.type2 && <TypePill name={member.pokemon.type2} />}
                        {!member.pokemon.pcAvailable && (
                            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                Not in PC
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">
                            Nature:{' '}
                            <span className="text-foreground font-medium">{member.nature}</span>
                            <NatureBadge effect={member.natureEffect} />
                        </span>
                        <span className="text-muted-foreground">
                            Ability:{' '}
                            <Popover>
                                <PopoverTrigger className="text-foreground font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:underline">
                                    {member.ability.displayName}
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-80">
                                    <AbilityDescription
                                        displayName={member.ability.displayName}
                                        shortEffect={member.ability.shortEffect}
                                        effect={member.ability.effect}
                                        pcNotes={member.ability.pcNotes}
                                    />
                                </PopoverContent>
                            </Popover>
                        </span>
                        <span className="text-muted-foreground">
                            Item:{' '}
                            {member.item ? (
                                <Popover>
                                    <PopoverTrigger className="text-foreground font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:underline">
                                        {member.item.displayName}
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="w-80">
                                        <ItemDescription
                                            displayName={member.item.displayName}
                                            category={member.item.category}
                                            shortEffect={member.item.shortEffect}
                                            effect={member.item.effect}
                                            pcAvailable={member.item.pcAvailable}
                                            pcNotes={member.item.pcNotes}
                                            isMegaStone={member.item.isMegaStone}
                                        />
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <span className="text-foreground font-medium">—</span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Moves</h3>
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {member.moves.map((move) => (
                        <li key={`${move.slot}-${move.id}`} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1 text-sm">
                            <MoveClassIcon cls={move.damageClass} />
                            <Popover>
                                <PopoverTrigger className={cn(
                                    'text-left underline-offset-2 hover:underline focus:outline-none focus-visible:underline',
                                    !move.pcAvailable && 'line-through opacity-60',
                                )}>
                                    {move.displayName}
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-80">
                                    <MoveDescription
                                        displayName={move.displayName}
                                        type={move.type}
                                        damageClass={move.damageClass}
                                        power={move.power}
                                        accuracy={move.accuracy}
                                        ppPc={move.ppPc}
                                        priority={move.priority}
                                        effectChance={move.effectChance}
                                        shortEffect={move.shortEffect}
                                        effect={move.effect}
                                        pcNotes={move.pcNotes}
                                    />
                                </PopoverContent>
                            </Popover>
                            <TypePill name={capitalize(move.type)} className="ml-auto" />
                        </li>
                    ))}
                </ul>
            </div>

            <StatsGrid member={member} />
        </div>
    );
}
