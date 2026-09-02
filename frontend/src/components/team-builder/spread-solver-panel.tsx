// F7 v2: multi-constraint spread solver. Stack several benchmarks (outspeed A,
// survive B's move, OHKO/2HKO C) and solve for one legal spread (<=32/stat,
// <=66 total) that meets them all, with an "Apply full spread" that writes every
// stat at once. Each constraint is normalized to a plain req at add-time (using
// the target's F2 most-common spread), so solving needs no further fetches.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getMetaTarget, getPokemonDetail, getTypeChart,
    type MetaTarget, type MetaTargetMove,
} from '@/modules/api/endpoints';
import { PokemonPicker } from '@/components/pickers/pokemon-picker';
import { EV_TOTAL_CAP, type EvBlock } from '@/components/pickers/ev-inputs';
import { isStabType, typeEffectiveness } from '@/lib/damage-calc';
import {
    solveSpread, type SpeedReq, type SurviveReq, type KoReq, type PointBlock,
} from '@/lib/spread-optimizer';
import { capitalize } from '@/lib/utils';

type Kind = 'outspeed' | 'survive' | 'ohko' | '2hko';

type Stored =
    | { id: number; kind: 'outspeed'; req: SpeedReq }
    | { id: number; kind: 'survive'; req: SurviveReq }
    | { id: number; kind: 'ohko' | '2hko'; req: KoReq };

interface Props {
    pokemonId: number;
    baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
    type1: string;
    type2: string | null;
    /** This mon's chosen ability display name (Protean/Libero => all-STAB). */
    ability: string | null;
    nature: string;
    moveIds: Array<number | null>;
    format: 'doubles' | 'singles';
    onApply: (key: keyof EvBlock, points: number) => void;
}

const KIND_LABEL: Record<Kind, string> = {
    outspeed: 'Outspeed', survive: 'Survive', ohko: 'OHKO', '2hko': '2HKO',
};
const STAT_LABEL: Record<keyof PointBlock, string> = {
    hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

export function SpreadSolverPanel({ pokemonId, baseStats, type1, type2, ability, nature, moveIds, format, onApply }: Props) {
    const [constraints, setConstraints] = useState<Stored[]>([]);
    const [kind, setKind] = useState<Kind>('outspeed');
    const [targetId, setTargetId] = useState<number | null>(null);
    const [moveIdx, setMoveIdx] = useState(0);

    const { data: typeChart } = useQuery({ queryKey: ['types', 'chart'], queryFn: getTypeChart });
    const { data: detail } = useQuery({ queryKey: ['pokemon', pokemonId], queryFn: () => getPokemonDetail(pokemonId) });
    const target = useQuery({
        queryKey: ['meta-target', format, targetId],
        queryFn: () => getMetaTarget(format, targetId!),
        enabled: targetId !== null,
    });

    const myTypes = [type1, type2].filter((t): t is string => Boolean(t)).map(capitalize);
    const myMoves = useMemo<MetaTargetMove[]>(() => {
        if (!detail) return [];
        const ids = new Set(moveIds.filter((m): m is number => m !== null));
        return detail.moves
            .filter((m) => ids.has(m.id) && m.power !== null)
            .map((m) => ({ displayName: m.displayName, type: m.type, power: m.power!, damageClass: m.damageClass }));
    }, [detail, moveIds]);

    // Which move list the draft dropdown shows: target's moves for "survive",
    // this mon's moves for the KO kinds, none for "outspeed".
    const draftMoves = kind === 'survive' ? (target.data?.moves ?? []) : (kind === 'outspeed' ? [] : myMoves);
    const needsMove = kind !== 'outspeed';
    const canAdd = target.data != null && typeChart != null && (!needsMove || draftMoves.length > 0);

    const addConstraint = () => {
        const t = target.data;
        if (!t || !typeChart) return;
        const id = Date.now();
        const built = buildConstraint(id, kind, t, moveIdx, myTypes, ability, myMoves, typeChart);
        if (!built) return;
        setConstraints((prev) => [...prev, built]);
        setMoveIdx(0);
    };

    const result = useMemo(() => solveSpread({
        base: baseStats,
        nature,
        speed: constraints.filter((c): c is Extract<Stored, { kind: 'outspeed' }> => c.kind === 'outspeed').map((c) => c.req),
        survive: constraints.filter((c): c is Extract<Stored, { kind: 'survive' }> => c.kind === 'survive').map((c) => c.req),
        ko: constraints.filter((c): c is Extract<Stored, { kind: 'ohko' | '2hko' }> => c.kind === 'ohko' || c.kind === '2hko').map((c) => c.req),
    }, EV_TOTAL_CAP), [constraints, baseStats, nature]);

    const applyAll = () => {
        (Object.keys(result.points) as Array<keyof PointBlock>).forEach((k) => onApply(k, result.points[k]));
    };

    return (
        <details className="rounded-md border p-3 group">
            <summary className="cursor-pointer text-sm font-semibold">Multi-target solver (v2)</summary>
            <div className="mt-3 flex flex-col gap-3">
                <p className="text-[11px] text-muted-foreground">
                    Add several benchmarks; solve one spread that meets them all within {EV_TOTAL_CAP} points.
                </p>

                {/* Draft constraint builder */}
                <div className="flex flex-col gap-2 rounded border bg-muted/20 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={kind}
                            onChange={(e) => { setKind(e.target.value as Kind); setMoveIdx(0); }}
                            className="rounded-md ring-1 ring-inset ring-input bg-transparent px-1.5 py-1 text-xs"
                        >
                            {(['outspeed', 'survive', 'ohko', '2hko'] as Kind[]).map((k) => (
                                <option key={k} value={k}>{KIND_LABEL[k]}</option>
                            ))}
                        </select>
                        <div className="min-w-[160px] flex-1">
                            <PokemonPicker value={targetId} onChange={(id) => { setTargetId(id); setMoveIdx(0); }} />
                        </div>
                    </div>

                    {needsMove && target.data && draftMoves.length > 0 && (
                        <select
                            value={moveIdx}
                            onChange={(e) => setMoveIdx(Number(e.target.value))}
                            className="rounded-md ring-1 ring-inset ring-input bg-transparent px-1.5 py-1 text-xs"
                        >
                            {draftMoves.map((m, i) => (
                                <option key={i} value={i}>
                                    {m.displayName} ({capitalize(m.type)} {m.damageClass === 'physical' ? 'phys' : 'spec'})
                                </option>
                            ))}
                        </select>
                    )}
                    {kind === 'survive' && target.data && draftMoves.length === 0 && (
                        <span className="text-[11px] text-muted-foreground">No known damaging moves for this target.</span>
                    )}
                    {needsMove && kind !== 'survive' && myMoves.length === 0 && (
                        <span className="text-[11px] text-muted-foreground">Pick this mon's damaging moves first.</span>
                    )}
                    {target.data && !target.data.hasUsage && (
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">
                            No {format} usage for this target, assuming a neutral 0-EV spread.
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={addConstraint}
                        disabled={!canAdd}
                        style={canAdd ? { backgroundColor: '#059669', color: '#fff' } : undefined}
                        className="self-start rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 disabled:ring-1 disabled:ring-inset disabled:ring-input"
                    >
                        + Add constraint
                    </button>
                </div>

                {/* Constraint list */}
                {constraints.length > 0 && (
                    <ul className="flex flex-col gap-1">
                        {constraints.map((c) => {
                            const met = !result.infeasible.includes(c.req.label);
                            return (
                                <li key={c.id} className="flex items-center justify-between gap-2 rounded border bg-muted/10 px-2 py-1 text-xs">
                                    <span className="flex items-center gap-1.5 min-w-0">
                                        <span className={met ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                                            {met ? '✓' : '✗'}
                                        </span>
                                        <span className="truncate">{c.req.label}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setConstraints((prev) => prev.filter((x) => x.id !== c.id))}
                                        className="shrink-0 text-muted-foreground hover:text-foreground"
                                        aria-label="Remove constraint"
                                    >
                                        ✕
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* Result */}
                {constraints.length > 0 && (
                    <div className="flex flex-col gap-2 rounded border p-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Solved spread</span>
                            <span className={result.leftover < 0 ? 'text-xs text-destructive tabular-nums' : 'text-xs text-muted-foreground tabular-nums'}>
                                {result.totalUsed} / {EV_TOTAL_CAP} used · {result.leftover < 0 ? `${-result.leftover} over` : `${result.leftover} left`}
                            </span>
                        </div>

                        <div className="grid grid-cols-6 gap-1 text-center">
                            {(Object.keys(STAT_LABEL) as Array<keyof PointBlock>).map((k) => (
                                <div key={k} className="rounded bg-muted/30 py-1">
                                    <div className="text-[9px] uppercase text-muted-foreground">{STAT_LABEL[k]}</div>
                                    <div className="text-xs font-semibold tabular-nums">{result.points[k]}</div>
                                </div>
                            ))}
                        </div>

                        {result.infeasible.length > 0 && (
                            <p className="text-[11px] text-destructive">
                                Can't meet: {result.infeasible.join('; ')} (even at 32 points).
                            </p>
                        )}
                        {result.infeasible.length === 0 && result.leftover < 0 && (
                            <p className="text-[11px] text-destructive">
                                These benchmarks each work alone but need {result.totalUsed} points together, {-result.leftover} over the {EV_TOTAL_CAP} cap. Drop one.
                            </p>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={applyAll}
                                disabled={!result.feasible}
                                style={result.feasible ? { backgroundColor: '#059669', color: '#fff' } : undefined}
                                className="rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 disabled:ring-1 disabled:ring-inset disabled:ring-input"
                            >
                                Apply full spread
                            </button>
                            <button
                                type="button"
                                onClick={() => setConstraints([])}
                                className="rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset ring-input text-muted-foreground hover:text-foreground"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </details>
    );
}

function buildConstraint(
    id: number, kind: Kind, t: MetaTarget, moveIdx: number,
    myTypes: string[], myAbility: string | null, myMoves: MetaTargetMove[],
    typeChart: Record<string, Record<string, number>>,
): Stored | null {
    if (kind === 'outspeed') {
        return { id, kind, req: { label: `Outspeed ${t.displayName} (${t.finalStats.spe} Spe)`, targetSpe: t.finalStats.spe } };
    }
    if (kind === 'survive') {
        const move = t.moves[moveIdx];
        if (!move) return null;
        const isPhysical = move.damageClass === 'physical';
        return {
            id, kind,
            req: {
                label: `Survive ${t.displayName}'s ${move.displayName}`,
                attackerStat: isPhysical ? t.finalStats.atk : t.finalStats.spa,
                movePower: move.power,
                isStab: isStabType(move.type, t.type1, t.type2, t.ability),
                typeMult: typeEffectiveness(move.type, myTypes[0], myTypes[1] ?? null, typeChart),
                isPhysical,
            },
        };
    }
    // ohko / 2hko, uses this mon's move against the target
    const move = myMoves[moveIdx];
    if (!move) return null;
    const isPhysical = move.damageClass === 'physical';
    return {
        id, kind,
        req: {
            label: `${kind === 'ohko' ? 'OHKO' : '2HKO'} ${t.displayName} w/ ${move.displayName}`,
            hits: kind === 'ohko' ? 1 : 2,
            movePower: move.power,
            isStab: isStabType(move.type, myTypes[0], myTypes[1] ?? null, myAbility),
            typeMult: typeEffectiveness(move.type, t.type1, t.type2, typeChart),
            isPhysical,
            targetDef: isPhysical ? t.finalStats.def : t.finalStats.spd,
            targetHp: t.finalStats.hp,
        },
    };
}
