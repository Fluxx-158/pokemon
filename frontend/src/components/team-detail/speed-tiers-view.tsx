// F4: interactive speed-tier ladder. Your team's EV-loaded speeds + the
// F2-derived meta speeds (common spread + fast benchmark), with live modifier
// toggles (Tailwind / Trick Room / weather + terrain speed abilities / Choice
// Scarf / paralysis / stat stages) that recompute and re-sort. Shared by the
// team Speed tab and the standalone /speed-tiers page.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSpeedTiers, type TeamDetail } from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { TypePill } from '@/components/type-pill';
import { FormatToggle, useCalcMode } from '@/components/damage-calc/format-toggle';
import {
    buildLadder,
    EMPTY_PER_MON,
    outspeedShare,
    type GlobalMods,
    type PerMonMods,
    type SpeedEntry,
    type Terrain,
    type Weather,
} from '@/lib/speed-tiers';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { seasonLabel } from '@/lib/season';
import { UsageUnavailable } from '@/components/usage-unavailable';

const EMPTY_GLOBAL: GlobalMods = { tailwind: false, trickRoom: false, weather: 'none', terrain: 'none' };

export function SpeedTiersView({ team }: { team: TeamDetail }) {
    const { mode, isDoubles, setMode, showToggle } = useCalcMode(team.format);
    const format = isDoubles ? 'doubles' : 'singles';

    const [global, setGlobal] = useState<GlobalMods>(EMPTY_GLOBAL);
    const [perMon, setPerMon] = useState<Record<number, PerMonMods>>({});

    const { data, isLoading, error } = useQuery({
        queryKey: ['speed-tiers', format],
        queryFn: () => getSpeedTiers(format, 40),
    });

    const setMon = (id: number, patch: Partial<PerMonMods>) =>
        setPerMon((prev) => ({ ...prev, [id]: { ...EMPTY_PER_MON, ...prev[id], ...patch } }));

    const entries = useMemo<SpeedEntry[]>(() => {
        const teamEntries: SpeedEntry[] = team.members.map((m) => ({
            key: `team-${m.id}`,
            pokemonId: m.pokemon.id,
            displayName: m.pokemon.displayName,
            type1: m.pokemon.type1,
            type2: m.pokemon.type2,
            side: 'team',
            baseFinalSpe: m.finalStats.spe,
            ability: m.ability.displayName,
            perMon: perMon[m.id] ?? EMPTY_PER_MON,
        }));
        const metaEntries: SpeedEntry[] = (data?.mons ?? []).map((mm) => ({
            key: `meta-${mm.pokemonId}`,
            pokemonId: mm.pokemonId,
            displayName: mm.displayName,
            type1: mm.type1,
            type2: mm.type2,
            side: 'meta',
            baseFinalSpe: mm.commonSpe,
            fastFinalSpe: mm.fastSpe,
            ability: mm.speedAbility,
            scarfCommon: mm.scarfCommon,
            presence: mm.presence,
        }));
        return [...teamEntries, ...metaEntries];
    }, [team.members, data, perMon]);

    const ladder = useMemo(() => buildLadder(entries, global), [entries, global]);
    // Map team member id by pokemonId for per-mon control wiring.
    const memberIdByPokemon = useMemo(() => {
        const m = new Map<number, number>();
        for (const mem of team.members) m.set(mem.pokemon.id, mem.id);
        return m;
    }, [team.members]);

    return (
        <div className="flex flex-col gap-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border p-3">
                {showToggle && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</span>
                        <FormatToggle mode={mode} onChange={setMode} />
                    </div>
                )}
                <ToggleChip active={global.tailwind} onClick={() => setGlobal((g) => ({ ...g, tailwind: !g.tailwind }))}>
                    Tailwind ×2
                </ToggleChip>
                <ToggleChip active={global.trickRoom} onClick={() => setGlobal((g) => ({ ...g, trickRoom: !g.trickRoom }))}>
                    Trick Room
                </ToggleChip>
                <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Weather</span>
                    <Select value={global.weather} onValueChange={(v) => setGlobal((g) => ({ ...g, weather: v as Weather }))}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="sun">Sun</SelectItem>
                            <SelectItem value="rain">Rain</SelectItem>
                            <SelectItem value="sand">Sand</SelectItem>
                            <SelectItem value="snow">Snow</SelectItem>
                        </SelectContent>
                    </Select>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Terrain</span>
                    <Select value={global.terrain} onValueChange={(v) => setGlobal((g) => ({ ...g, terrain: v as Terrain }))}>
                        <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="electric">Electric</SelectItem>
                        </SelectContent>
                    </Select>
                </label>
                <span className="ml-auto text-[11px] text-muted-foreground">
                    {data?.sourceGeneratedAt && `${seasonLabel(data.sourceSeason)}meta speeds · ${data.sourceGeneratedAt.slice(0, 10)}`}
                </span>
            </div>

            {global.trickRoom && (
                <div className="rounded-md border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                    Trick Room active, <strong>slowest moves first</strong>. The ladder is inverted.
                </div>
            )}

            {isLoading && <p className="text-sm text-muted-foreground">Loading meta speeds…</p>}
            {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Failed to load meta speeds'}</p>}

            {/* No meta rows ⇒ offline / never synced. Your team ladder still
                renders below (its speeds come from the team, not usage). */}
            {data && data.mons.length === 0 && !isLoading && (
                <UsageUnavailable what="Meta speed tiers" />
            )}

            <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-2 py-1.5 text-right font-semibold w-[64px]">Spe</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Pokémon</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Set / modifiers</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ladder.rows.map((row) => {
                            const e = row.entry;
                            const isTeam = e.side === 'team';
                            const memberId = isTeam ? memberIdByPokemon.get(e.pokemonId) : undefined;
                            const pm = (memberId != null ? perMon[memberId] : undefined) ?? EMPTY_PER_MON;
                            return (
                                <tr key={e.key} className={cn('border-b last:border-0', isTeam && 'bg-emerald-50/60 dark:bg-emerald-900/20')}>
                                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                        {row.effective}
                                        {row.speedBoosted && <span className="ml-0.5 text-[10px] text-sky-600 dark:text-sky-400">×2</span>}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <div className="flex items-center gap-2">
                                            <Sprite id={e.pokemonId} className="h-7 w-7 shrink-0" loading="lazy" decoding="async" />
                                            <span className="truncate font-medium">{e.displayName}</span>
                                            <TypePill name={e.type1} className="text-[10px]" />
                                            {e.type2 && <TypePill name={e.type2} className="text-[10px]" />}
                                            {isTeam && (
                                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                                    yours
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                                        {isTeam && memberId != null ? (
                                            <div className="flex flex-wrap items-center gap-1">
                                                <ToggleChip small active={pm.scarf} onClick={() => setMon(memberId, { scarf: !pm.scarf })}>Scarf</ToggleChip>
                                                <ToggleChip small active={pm.paralysis} onClick={() => setMon(memberId, { paralysis: !pm.paralysis })}>Par</ToggleChip>
                                                <ToggleChip small active={pm.stage === 1} onClick={() => setMon(memberId, { stage: pm.stage === 1 ? 0 : 1 })}>+1</ToggleChip>
                                                <ToggleChip small active={pm.stage === 2} onClick={() => setMon(memberId, { stage: pm.stage === 2 ? 0 : 2 })}>+2</ToggleChip>
                                                <span className="ml-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                                                    outspeeds {outspeedShare(row.effective, ladder)}% of meta
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                <span>{(data?.mons.find((m) => m.pokemonId === e.pokemonId)?.commonLabel) ?? ''}</span>
                                                {row.effectiveFast !== undefined && row.effectiveFast !== row.effective && (
                                                    <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                                        fast {row.effectiveFast}
                                                    </span>
                                                )}
                                                {e.scarfCommon && (
                                                    <span className="rounded bg-zinc-200 px-1 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Scarf seen</span>
                                                )}
                                                {row.speedBoosted && e.ability && (
                                                    <span className="text-[10px] text-sky-700 dark:text-sky-300">{e.ability}</span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="text-[11px] text-muted-foreground">
                Your speeds are EV-loaded from the registered set. Meta speeds use each Pokémon's most-common
                spread (with a fast max-invest benchmark). Order of ops: stage → weather/terrain ability → Scarf →
                paralysis → Tailwind. Paralysis still halves Speed in M-B.
            </p>
        </div>
    );
}

function ToggleChip({
    active, onClick, children, small,
}: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            // NOTE: deliberately NOT using the `border` class, the backdrop theme
            // force-paints `.rounded.border` with the card color via !important,
            // which overrides even inline bg. We outline with `ring` instead and
            // set the active fill/text inline.
            style={active ? { backgroundColor: '#059669', color: '#ffffff' } : undefined}
            className={cn(
                'rounded-md font-medium transition-colors ring-1 ring-inset',
                small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                active ? 'ring-emerald-700' : 'ring-input text-muted-foreground hover:text-foreground',
            )}
        >
            {children}
        </button>
    );
}
