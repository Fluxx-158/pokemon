import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getPokemonDetail,
    getPokemonList,
    getTypeChart,
    type TeamDetail,
} from '@/modules/api/endpoints';
import { Sprite } from '@/components/sprite';
import { EMPTY_MODIFIERS, ModifierPanel, type ModifierState } from '@/components/damage-calc/modifier-panel';
import { ResultCard } from '@/components/damage-calc/result-card';
import { dedupeDamagingMoves, runCalc } from '@/components/damage-calc/run-calc';
import { MoveClassIcon } from '@/components/move-class-icon';
import { PokemonPicker } from '@/components/pickers/pokemon-picker';
import { TypePill } from '@/components/type-pill';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    defaultHp,
    defaultStat,
} from '@/lib/damage-calc';
import { capitalize, clampInt, cn } from '@/lib/utils';

export function TeamCalcTab({ team }: { team: TeamDetail }) {
    const [direction, setDirection] = useState<'attack' | 'defend'>('attack');
    const teamIsAttacker = direction === 'attack';

    const [teamSlot, setTeamSlot] = useState<number>(team.members[0]?.slot ?? 1);
    const teamMember = team.members.find((m) => m.slot === teamSlot) ?? team.members[0];

    const teamDamagingMoves = useMemo(
        () => teamMember?.moves.filter((m) => m.power !== null) ?? [],
        [teamMember],
    );
    const [teamMoveId, setTeamMoveId] = useState<number | null>(teamDamagingMoves[0]?.id ?? null);
    useEffect(() => {
        const next = teamDamagingMoves[0]?.id ?? null;
        if (teamMoveId !== null && !teamDamagingMoves.some((m) => m.id === teamMoveId)) {
            setTeamMoveId(next);
        } else if (teamMoveId === null && next !== null) {
            setTeamMoveId(next);
        }
    }, [teamDamagingMoves, teamMoveId]);

    const [freePokemonId, setFreePokemonId] = useState<number | null>(null);
    const [freeMoveId, setFreeMoveId] = useState<number | null>(null);
    const [freeLevel, setFreeLevel] = useState(50);
    const [freeAtk, setFreeAtk] = useState(0);
    const [freeSpa, setFreeSpa] = useState(0);
    const [freeHp, setFreeHp] = useState(0);
    const [freeDef, setFreeDef] = useState(0);
    const [freeSpd, setFreeSpd] = useState(0);

    const [crit, setCrit] = useState(false);
    const [mods, setMods] = useState<ModifierState>(EMPTY_MODIFIERS);

    const { data: pokemonList } = useQuery({ queryKey: ['pokemon'], queryFn: getPokemonList });
    const { data: typeChart } = useQuery({ queryKey: ['types', 'chart'], queryFn: getTypeChart });
    const freeSummary = useMemo(
        () => (pokemonList && freePokemonId !== null) ? pokemonList.find((p) => p.id === freePokemonId) ?? null : null,
        [pokemonList, freePokemonId],
    );

    const freeDetail = useQuery({
        queryKey: ['pokemon', freePokemonId],
        queryFn: () => getPokemonDetail(freePokemonId!),
        enabled: freePokemonId !== null && !teamIsAttacker,
    });
    const freeDamagingMoves = useMemo(
        () => freeDetail.data ? dedupeDamagingMoves(freeDetail.data.moves) : [],
        [freeDetail.data],
    );

    useEffect(() => {
        if (freeSummary) {
            setFreeAtk(defaultStat(freeSummary.stats.atk, freeLevel));
            setFreeSpa(defaultStat(freeSummary.stats.spa, freeLevel));
            setFreeHp(defaultHp(freeSummary.stats.hp, freeLevel));
            setFreeDef(defaultStat(freeSummary.stats.def, freeLevel));
            setFreeSpd(defaultStat(freeSummary.stats.spd, freeLevel));
            setFreeMoveId(null);
        } else {
            setFreeAtk(0); setFreeSpa(0); setFreeHp(0); setFreeDef(0); setFreeSpd(0);
            setFreeMoveId(null);
        }
    }, [freeSummary, freeLevel]);

    const selectedMove = teamIsAttacker
        ? teamDamagingMoves.find((m) => m.id === teamMoveId) ?? null
        : freeDamagingMoves.find((m) => m.id === freeMoveId) ?? null;

    const calc = useMemo(() => {
        if (!teamMember || !freeSummary || !selectedMove) return null;
        const isPhysical = selectedMove.damageClass === 'physical';

        return runCalc({
            attackerType1: teamIsAttacker ? teamMember.pokemon.type1 : freeSummary.type1,
            attackerType2: teamIsAttacker ? teamMember.pokemon.type2 : freeSummary.type2,
            defenderType1: teamIsAttacker ? freeSummary.type1 : teamMember.pokemon.type1,
            defenderType2: teamIsAttacker ? freeSummary.type2 : teamMember.pokemon.type2,
            defenderHp: teamIsAttacker ? freeHp : teamMember.finalStats.hp,
            attackingStat: teamIsAttacker
                ? (isPhysical ? teamMember.finalStats.atk : teamMember.finalStats.spa)
                : (isPhysical ? freeAtk : freeSpa),
            defendingStat: teamIsAttacker
                ? (isPhysical ? freeDef : freeSpd)
                : (isPhysical ? teamMember.finalStats.def : teamMember.finalStats.spd),
            level: teamIsAttacker ? 50 : freeLevel,
            move: selectedMove,
            isCritical: crit,
            mods,
            typeChart,
        });
    }, [teamIsAttacker, teamMember, freeSummary, selectedMove, typeChart,
        freeAtk, freeSpa, freeHp, freeDef, freeSpd, freeLevel, crit, mods]);

    if (team.members.length === 0) {
        return <p className="text-sm text-muted-foreground">No team members yet.</p>;
    }

    const teamCard = (role: 'Attacker' | 'Defender') => (
        <div className={cn(
            'rounded-md border p-4 flex flex-col gap-3',
            role === 'Attacker' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20',
        )}>
            <div className="flex items-baseline justify-between">
                <h3 className="dossier-eyebrow">
                    {role} <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">your team</span>
                </h3>
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">From your team</label>
                <Select value={String(teamSlot)} onValueChange={(v) => setTeamSlot(Number(v))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {team.members.map((m) => (
                            <SelectItem key={m.slot} value={String(m.slot)}>
                                <span className="flex items-center gap-2">
                                    <Sprite id={m.pokemon.id} className="h-5 w-5" />
                                    Slot {m.slot}: {m.pokemon.displayName}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {teamMember && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    {role === 'Attacker' ? (
                        <>
                            <span>Atk: <span className="text-foreground">{teamMember.finalStats.atk}</span></span>
                            <span>SpA: <span className="text-foreground">{teamMember.finalStats.spa}</span></span>
                        </>
                    ) : (
                        <>
                            <span>HP: <span className="text-foreground">{teamMember.finalStats.hp}</span></span>
                            <span>Def: <span className="text-foreground">{teamMember.finalStats.def}</span></span>
                            <span>SpD: <span className="text-foreground">{teamMember.finalStats.spd}</span></span>
                        </>
                    )}
                    <span>Nature: <span className="text-foreground">{teamMember.nature}</span></span>
                </div>
            )}
            {role === 'Attacker' && (
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Move</label>
                    <Select
                        value={teamMoveId !== null ? String(teamMoveId) : ''}
                        onValueChange={(v) => setTeamMoveId(v ? Number(v) : null)}
                        disabled={teamDamagingMoves.length === 0}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={teamDamagingMoves.length === 0 ? 'No damaging moves' : 'Pick a move'} />
                        </SelectTrigger>
                        <SelectContent>
                            {teamDamagingMoves.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                    <span className="flex items-center gap-2">
                                        <MoveClassIcon cls={m.damageClass} withTooltip={false} />
                                        <span>{m.displayName}</span>
                                        <TypePill name={capitalize(m.type)} className="text-[10px]" />
                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                            {m.power}/{m.accuracy ?? '—'}
                                        </span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );

    const freeformCard = (role: 'Attacker' | 'Defender') => (
        <div className={cn(
            'rounded-md border p-4 flex flex-col gap-3',
            role === 'Attacker' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20',
        )}>
            <h3 className="dossier-eyebrow">
                {role} <span className="ml-1 rounded bg-zinc-200 px-1 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">opponent</span>
            </h3>
            <PokemonPicker value={freePokemonId} onChange={setFreePokemonId} />
            {freeSummary && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Sprite id={freeSummary.id} className="h-8 w-8" />
                    <TypePill name={freeSummary.type1} className="text-[10px]" />
                    {freeSummary.type2 && <TypePill name={freeSummary.type2} className="text-[10px]" />}
                </div>
            )}
            {role === 'Attacker' ? (
                <>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Level</label>
                            <Input type="number" value={freeLevel} min={1} max={100}
                                onChange={(e) => setFreeLevel(clampInt(e.target.value, 1, 100))} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Atk</label>
                            <Input type="number" value={freeAtk} min={0}
                                onChange={(e) => setFreeAtk(clampInt(e.target.value, 0, 999))}
                                className={cn(selectedMove?.damageClass !== 'physical' && 'opacity-60')} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">SpA</label>
                            <Input type="number" value={freeSpa} min={0}
                                onChange={(e) => setFreeSpa(clampInt(e.target.value, 0, 999))}
                                className={cn(selectedMove?.damageClass !== 'special' && 'opacity-60')} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Move</label>
                        <Select
                            value={freeMoveId !== null ? String(freeMoveId) : ''}
                            onValueChange={(v) => setFreeMoveId(v ? Number(v) : null)}
                            disabled={freePokemonId === null || freeDamagingMoves.length === 0}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={
                                    freePokemonId === null ? 'Pick a Pokemon first'
                                        : freeDamagingMoves.length === 0 ? 'No damaging moves'
                                        : 'Pick a move'
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {freeDamagingMoves.map((m) => (
                                    <SelectItem key={m.id} value={String(m.id)}>
                                        <span className="flex items-center gap-2">
                                            <MoveClassIcon cls={m.damageClass} withTooltip={false} />
                                            <span>{m.displayName}</span>
                                            <TypePill name={capitalize(m.type)} className="text-[10px]" />
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {m.power}/{m.accuracy ?? '—'}
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Level</label>
                        <Input type="number" value={freeLevel} min={1} max={100}
                            onChange={(e) => setFreeLevel(clampInt(e.target.value, 1, 100))} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">HP</label>
                        <Input type="number" value={freeHp} min={1}
                            onChange={(e) => setFreeHp(clampInt(e.target.value, 1, 9999))} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Def</label>
                        <Input type="number" value={freeDef} min={1}
                            onChange={(e) => setFreeDef(clampInt(e.target.value, 1, 999))}
                            className={cn(selectedMove?.damageClass !== 'physical' && 'opacity-60')} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">SpD</label>
                        <Input type="number" value={freeSpd} min={1}
                            onChange={(e) => setFreeSpd(clampInt(e.target.value, 1, 999))}
                            className={cn(selectedMove?.damageClass !== 'special' && 'opacity-60')} />
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direction:</span>
                <div className="inline-flex rounded-md border p-0.5">
                    <button
                        type="button"
                        onClick={() => setDirection('attack')}
                        className={cn(
                            'rounded px-3 py-1 text-xs font-medium transition-colors',
                            teamIsAttacker ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        Your team attacks
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirection('defend')}
                        className={cn(
                            'rounded px-3 py-1 text-xs font-medium transition-colors',
                            !teamIsAttacker ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        Your team defends
                    </button>
                </div>
                <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox checked={crit} onCheckedChange={(v) => setCrit(v === true)} />
                    <span className="text-sm">Critical hit (×1.5)</span>
                </label>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {teamIsAttacker ? teamCard('Attacker') : freeformCard('Attacker')}
                {teamIsAttacker ? freeformCard('Defender') : teamCard('Defender')}
            </div>
            <ModifierPanel value={mods} onChange={setMods} />
            <ResultCard calc={calc} placeholder={
                teamIsAttacker
                    ? 'Pick a defender to compute damage.'
                    : 'Pick an attacker and a move to compute damage.'
            } />
        </div>
    );
}
