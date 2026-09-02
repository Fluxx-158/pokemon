// F7: per-member spread optimizer. Pick a target meta Pokémon, and three
// helpers compute the minimum stat-points to (a) outspeed it, (b) survive its
// attack, (c) OHKO/2HKO it, each with an Apply button that writes the EV input.
// Targets use the F2 most-common spread; "Apply" sets the absolute point value.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getMetaTarget,
    getPokemonDetail,
    getTypeChart,
    type MetaTargetMove,
} from '@/modules/api/endpoints';
import { PokemonPicker } from '@/components/pickers/pokemon-picker';
import { type EvBlock } from '@/components/pickers/ev-inputs';
import { isStabType, typeEffectiveness } from '@/lib/damage-calc';
import {
    minBulkToSurvive, minOffenseToKO, minSpeedPoints,
} from '@/lib/spread-optimizer';
import { capitalize } from '@/lib/utils';

interface Props {
    pokemonId: number;
    baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
    type1: string;
    type2: string | null;
    /** This mon's chosen ability display name (Protean/Libero => all-STAB). */
    ability: string | null;
    nature: string;
    evs: EvBlock;
    moveIds: Array<number | null>;
    format: 'doubles' | 'singles';
    onApply: (key: keyof EvBlock, points: number) => void;
}

export function OptimizePanel({ pokemonId, baseStats, type1, type2, ability, nature, evs, moveIds, format, onApply }: Props) {
    const [targetId, setTargetId] = useState<number | null>(null);

    const { data: typeChart } = useQuery({ queryKey: ['types', 'chart'], queryFn: getTypeChart });
    const { data: detail } = useQuery({ queryKey: ['pokemon', pokemonId], queryFn: () => getPokemonDetail(pokemonId) });
    const target = useQuery({
        queryKey: ['meta-target', format, targetId],
        queryFn: () => getMetaTarget(format, targetId!),
        enabled: targetId !== null,
    });

    // This mon's selected damaging moves (for the OHKO helper).
    const myMoves = useMemo<MetaTargetMove[]>(() => {
        if (!detail) return [];
        const ids = new Set(moveIds.filter((m): m is number => m !== null));
        return detail.moves
            .filter((m) => ids.has(m.id) && m.power !== null)
            .map((m) => ({ displayName: m.displayName, type: m.type, power: m.power!, damageClass: m.damageClass }));
    }, [detail, moveIds]);

    const myTypes = [type1, type2].filter((t): t is string => Boolean(t)).map(capitalize);

    return (
        <details className="rounded-md border p-3 group">
            <summary className="cursor-pointer text-sm font-semibold">Optimize spread vs a target</summary>
            <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Target Pokémon</label>
                    <PokemonPicker value={targetId} onChange={setTargetId} />
                    {target.data && !target.data.hasUsage && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            No usage data for this Pokémon in {format}, assuming a neutral, 0-EV spread.
                        </p>
                    )}
                    {target.data?.hasUsage && (
                        <p className="text-[11px] text-muted-foreground">Assumed set: {target.data.spreadLabel}</p>
                    )}
                </div>

                {targetId === null && (
                    <p className="text-xs text-muted-foreground">Pick a target to compute speed / survival / KO benchmarks.</p>
                )}

                {target.data && typeChart && (
                    <div className="flex flex-col gap-3">
                        <OutspeedHelper
                            baseSpe={baseStats.spe} nature={nature} currentSpe={evs.spe}
                            targetSpe={target.data.finalStats.spe} targetName={target.data.displayName}
                            onApply={(p) => onApply('spe', p)}
                        />
                        <SurviveHelper
                            target={target.data} myBase={baseStats} myTypes={myTypes} nature={nature}
                            currentHp={evs.hp} currentDef={evs.def} currentSpd={evs.spd}
                            typeChart={typeChart} onApply={onApply}
                        />
                        <KoHelper
                            target={target.data} myBase={baseStats} myTypes={myTypes} myAbility={ability} nature={nature}
                            myMoves={myMoves} currentAtk={evs.atk} currentSpa={evs.spa}
                            typeChart={typeChart} onApply={onApply}
                        />
                    </div>
                )}
            </div>
        </details>
    );
}

function ApplyBtn({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            // ring (not border) so the backdrop theme can't force the bg opaque.
            style={{ backgroundColor: '#059669', color: '#fff' }}
            className="rounded-md px-2 py-0.5 text-[11px] font-medium"
        >
            {label}
        </button>
    );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="rounded border bg-muted/20 p-2 text-xs">
            <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">{label}</div>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

function OutspeedHelper({ baseSpe, nature, currentSpe, targetSpe, targetName, onApply }: {
    baseSpe: number; nature: string; currentSpe: number; targetSpe: number; targetName: string; onApply: (p: number) => void;
}) {
    const need = minSpeedPoints(baseSpe, nature, targetSpe);
    return (
        <Line label="Outspeed">
            <span>{targetName} sits at <strong className="tabular-nums">{targetSpe}</strong> Spe.</span>
            {need === null ? (
                <span className="text-destructive">Can't outspeed even at 32 Spe ({nature}).</span>
            ) : (
                <>
                    <span>Need <strong className="tabular-nums">{need}</strong> Spe points (you have {currentSpe}).</span>
                    <ApplyBtn label={`Apply ${need}`} onClick={() => onApply(need)} />
                </>
            )}
        </Line>
    );
}

function SurviveHelper({ target, myBase, myTypes, nature, currentHp, currentDef, currentSpd, typeChart, onApply }: {
    target: import('@/modules/api/endpoints').MetaTarget;
    myBase: Props['baseStats']; myTypes: string[]; nature: string;
    currentHp: number; currentDef: number; currentSpd: number;
    typeChart: Record<string, Record<string, number>>; onApply: (k: keyof EvBlock, p: number) => void;
}) {
    const [moveIdx, setMoveIdx] = useState(0);
    const move = target.moves[moveIdx];
    if (target.moves.length === 0) return <Line label="Survive"><span className="text-muted-foreground">No known damaging moves for this target.</span></Line>;

    const isPhysical = move.damageClass === 'physical';
    const defKey = isPhysical ? 'def' : 'spd';
    const res = minBulkToSurvive({
        attackerStat: isPhysical ? target.finalStats.atk : target.finalStats.spa,
        movePower: move.power,
        isStab: isStabType(move.type, target.type1, target.type2, target.ability),
        typeMult: typeEffectiveness(move.type, myTypes[0], myTypes[1] ?? null, typeChart),
        isPhysical,
        defBaseHp: myBase.hp,
        defBase: isPhysical ? myBase.def : myBase.spd,
        defKey,
        nature,
        currentHpPoints: currentHp,
        currentDefPoints: isPhysical ? currentDef : currentSpd,
    });

    return (
        <Line label="Survive">
            <select
                value={moveIdx}
                onChange={(e) => setMoveIdx(Number(e.target.value))}
                className="rounded-md ring-1 ring-inset ring-input bg-transparent px-1.5 py-0.5 text-xs"
            >
                {target.moves.map((m, i) => <option key={i} value={i}>{m.displayName}</option>)}
            </select>
            <span>({capitalize(move.type)} {isPhysical ? 'phys' : 'spec'})</span>
            {res.currentlySurvives ? (
                <span className="text-emerald-700 dark:text-emerald-300">Already survives (max {res.currentMaxPercent}%).</span>
            ) : (
                <>
                    <span className="text-destructive">Currently {res.currentMaxPercent}% max, KO'd.</span>
                    {res.viaHp !== null && <ApplyBtn label={`HP ${res.viaHp}`} onClick={() => onApply('hp', res.viaHp!)} />}
                    {res.viaDef !== null && <ApplyBtn label={`${defKey === 'def' ? 'Def' : 'SpD'} ${res.viaDef}`} onClick={() => onApply(defKey, res.viaDef!)} />}
                    {res.viaHp === null && res.viaDef === null && <span className="text-destructive">Can't survive even at 32.</span>}
                </>
            )}
        </Line>
    );
}

function KoHelper({ target, myBase, myTypes, myAbility, nature, myMoves, currentAtk, currentSpa, typeChart, onApply }: {
    target: import('@/modules/api/endpoints').MetaTarget;
    myBase: Props['baseStats']; myTypes: string[]; myAbility: string | null; nature: string; myMoves: MetaTargetMove[];
    currentAtk: number; currentSpa: number;
    typeChart: Record<string, Record<string, number>>; onApply: (k: keyof EvBlock, p: number) => void;
}) {
    const [moveIdx, setMoveIdx] = useState(0);
    if (myMoves.length === 0) return <Line label="OHKO / 2HKO"><span className="text-muted-foreground">Pick this mon's damaging moves first.</span></Line>;
    const move = myMoves[Math.min(moveIdx, myMoves.length - 1)];
    const isPhysical = move.damageClass === 'physical';
    const offKey = isPhysical ? 'atk' : 'spa';

    const common = {
        offBase: isPhysical ? myBase.atk : myBase.spa,
        offKey: offKey as 'atk' | 'spa',
        nature,
        currentPoints: isPhysical ? currentAtk : currentSpa,
        movePower: move.power,
        isStab: isStabType(move.type, myTypes[0], myTypes[1] ?? null, myAbility),
        typeMult: typeEffectiveness(move.type, target.type1, target.type2, typeChart),
        isPhysical,
        targetDef: isPhysical ? target.finalStats.def : target.finalStats.spd,
        targetHp: target.finalStats.hp,
    };
    const ohko = minOffenseToKO(common, 1);
    const thko = minOffenseToKO(common, 2);

    return (
        <Line label="OHKO / 2HKO">
            <select
                value={moveIdx}
                onChange={(e) => setMoveIdx(Number(e.target.value))}
                className="rounded-md ring-1 ring-inset ring-input bg-transparent px-1.5 py-0.5 text-xs"
            >
                {myMoves.map((m, i) => <option key={i} value={i}>{m.displayName}</option>)}
            </select>
            {common.typeMult === 0 ? (
                <span className="text-muted-foreground">No effect on {target.displayName}.</span>
            ) : (
                <>
                    <span className="text-muted-foreground">(min roll {ohko.currentMinPercent}% now)</span>
                    {ohko.points !== null
                        ? <ApplyBtn label={`OHKO: ${offKey === 'atk' ? 'Atk' : 'SpA'} ${ohko.points}`} onClick={() => onApply(offKey, ohko.points!)} />
                        : <span className="text-muted-foreground">OHKO: not at 32</span>}
                    {thko.points !== null
                        ? <ApplyBtn label={`2HKO: ${offKey === 'atk' ? 'Atk' : 'SpA'} ${thko.points}`} onClick={() => onApply(offKey, thko.points!)} />
                        : <span className="text-muted-foreground">2HKO: not at 32</span>}
                </>
            )}
        </Line>
    );
}
