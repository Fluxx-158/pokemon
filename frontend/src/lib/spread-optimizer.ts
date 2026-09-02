// F7: targeted EV/stat-point optimizers. Reverse the speed + damage formulas to
// find the minimum stat-point investment (0–32) that hits a benchmark:
//   • outspeed a target
//   • survive a target's attack
//   • OHKO / 2HKO a target
// Reuses the same L50 Champions stat formula as the backend and the existing
// computeDamage. Pure, no React/network.

import { computeDamage, type DamageInput } from './damage-calc';

export const MAX_POINTS = 32;

type OffKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe';

// Nature ± map (mirrors backend stat-calculator).
const NATURES: Record<string, { plus: OffKey | null; minus: OffKey | null }> = {
    hardy: { plus: null, minus: null }, lonely: { plus: 'atk', minus: 'def' },
    brave: { plus: 'atk', minus: 'spe' }, adamant: { plus: 'atk', minus: 'spa' },
    naughty: { plus: 'atk', minus: 'spd' }, bold: { plus: 'def', minus: 'atk' },
    docile: { plus: null, minus: null }, relaxed: { plus: 'def', minus: 'spe' },
    impish: { plus: 'def', minus: 'spa' }, lax: { plus: 'def', minus: 'spd' },
    timid: { plus: 'spe', minus: 'atk' }, hasty: { plus: 'spe', minus: 'def' },
    serious: { plus: null, minus: null }, jolly: { plus: 'spe', minus: 'spa' },
    naive: { plus: 'spe', minus: 'spd' }, modest: { plus: 'spa', minus: 'atk' },
    mild: { plus: 'spa', minus: 'def' }, quiet: { plus: 'spa', minus: 'spe' },
    bashful: { plus: null, minus: null }, rash: { plus: 'spa', minus: 'spd' },
    calm: { plus: 'spd', minus: 'atk' }, gentle: { plus: 'spd', minus: 'def' },
    sassy: { plus: 'spd', minus: 'spe' }, careful: { plus: 'spd', minus: 'spa' },
    quirky: { plus: null, minus: null },
};

function natureMod(nature: string, key: OffKey): number {
    const n = NATURES[nature.trim().toLowerCase()];
    if (!n) return 1;
    if (n.plus === key) return 1.1;
    if (n.minus === key) return 0.9;
    return 1;
}

export function finalStat(base: number, key: OffKey, points: number, nature: string): number {
    const pre = Math.floor((2 * base + 31) * 50 / 100) + 5 + points;
    return Math.floor(pre * natureMod(nature, key));
}
export function finalHp(base: number, points: number): number {
    return Math.floor((2 * base + 31) * 50 / 100) + 50 + 10 + points;
}

// --- Outspeed ---
// Min Spe points so finalSpe > targetSpe. null if even 32 can't.
export function minSpeedPoints(base: number, nature: string, targetSpe: number): number | null {
    for (let p = 0; p <= MAX_POINTS; p++) {
        if (finalStat(base, 'spe', p, nature) > targetSpe) return p;
    }
    return null;
}

function dmgRange(attStat: number, defStat: number, power: number, isStab: boolean, typeMult: number, isPhysical: boolean, defHp: number) {
    const input: DamageInput = {
        level: 50, attackingStat: attStat, defendingStat: defStat, movePower: power,
        isStab, typeMultiplier: typeMult, isCritical: false, isPhysical,
    };
    return computeDamage(input, defHp);
}

// --- Survive ---
export interface SurviveInput {
    attackerStat: number;   // target's Atk or SpA (final)
    movePower: number;
    isStab: boolean;        // target's move is its STAB
    typeMult: number;       // target move vs your mon
    isPhysical: boolean;
    defBaseHp: number;
    defBase: number;        // your Def or SpD base
    defKey: 'def' | 'spd';
    nature: string;         // your nature
    currentHpPoints: number;
    currentDefPoints: number;
}
export interface SurviveResult {
    currentlySurvives: boolean;
    currentMaxPercent: number;
    viaHp: number | null;   // min HP points (holding Def at current) to survive max roll
    viaDef: number | null;  // min Def/SpD points (holding HP at current) to survive max roll
}

export function minBulkToSurvive(i: SurviveInput): SurviveResult {
    const hp0 = finalHp(i.defBaseHp, i.currentHpPoints);
    const def0 = finalStat(i.defBase, i.defKey, i.currentDefPoints, i.nature);
    const max0 = dmgRange(i.attackerStat, def0, i.movePower, i.isStab, i.typeMult, i.isPhysical, hp0).max;
    const currentMaxPercent = hp0 > 0 ? Math.round((max0 / hp0) * 100) : 0;

    let viaHp: number | null = null;
    for (let p = 0; p <= MAX_POINTS; p++) {
        const hp = finalHp(i.defBaseHp, p);
        if (dmgRange(i.attackerStat, def0, i.movePower, i.isStab, i.typeMult, i.isPhysical, hp).max < hp) { viaHp = p; break; }
    }
    let viaDef: number | null = null;
    for (let p = 0; p <= MAX_POINTS; p++) {
        const def = finalStat(i.defBase, i.defKey, p, i.nature);
        if (dmgRange(i.attackerStat, def, i.movePower, i.isStab, i.typeMult, i.isPhysical, hp0).max < hp0) { viaDef = p; break; }
    }
    return { currentlySurvives: max0 < hp0, currentMaxPercent, viaHp, viaDef };
}

// --- OHKO / 2HKO ---
export interface KoInput {
    offBase: number;        // your Atk or SpA base
    offKey: 'atk' | 'spa';
    nature: string;
    currentPoints: number;
    movePower: number;
    isStab: boolean;        // your move is your STAB
    typeMult: number;       // your move vs target
    isPhysical: boolean;
    targetDef: number;      // target's Def or SpD (final)
    targetHp: number;
}
export interface KoResult {
    currentMinPercent: number;
    points: number | null;  // min offensive points to guarantee the KO (min roll)
}

export function minOffenseToKO(i: KoInput, hits: 1 | 2): KoResult {
    const threshold = hits === 1 ? i.targetHp : Math.ceil(i.targetHp / 2);
    const cur = finalStat(i.offBase, i.offKey, i.currentPoints, i.nature);
    const curMin = dmgRange(cur, i.targetDef, i.movePower, i.isStab, i.typeMult, i.isPhysical, i.targetHp).min;
    const currentMinPercent = i.targetHp > 0 ? Math.round((curMin / i.targetHp) * 100) : 0;

    let points: number | null = null;
    for (let p = 0; p <= MAX_POINTS; p++) {
        const att = finalStat(i.offBase, i.offKey, p, i.nature);
        if (dmgRange(att, i.targetDef, i.movePower, i.isStab, i.typeMult, i.isPhysical, i.targetHp).min >= threshold) { points = p; break; }
    }
    return { currentMinPercent, points };
}

// --- v2: multi-constraint solver ---------------------------------------------
// Find one legal spread (each stat 0..32, total <= budget) that satisfies every
// constraint at once, using the fewest points. Speed and offense reduce to
// independent single-stat minima; survival couples HP with the defensive stat,
// so we sweep HP (0..32) and, at each level, take the least Def/SpD that holds.
// HP is shared across physical AND special survival, so the sweep captures that
// trade-off. The global minimum is these minima summed (the stats don't overlap).

export type PointBlock = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
export const EMPTY_POINTS: PointBlock = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

export interface SpeedReq { label: string; targetSpe: number; }
export interface SurviveReq {
    label: string; attackerStat: number; movePower: number;
    isStab: boolean; typeMult: number; isPhysical: boolean;
}
export interface KoReq {
    label: string; hits: 1 | 2; movePower: number; isStab: boolean;
    typeMult: number; isPhysical: boolean; targetDef: number; targetHp: number;
}
export interface SolveConstraints {
    base: PointBlock;       // the mon's base stats (hp field = base HP)
    nature: string;
    speed: SpeedReq[];
    survive: SurviveReq[];
    ko: KoReq[];
}
export interface SolveResult {
    /** Every constraint met AND the spread fits the budget. */
    feasible: boolean;
    points: PointBlock;
    totalUsed: number;
    leftover: number;       // budget - totalUsed (negative => over budget)
    infeasible: string[];   // labels that cannot be met even at 32 points on their stat(s)
}

export const DEFAULT_BUDGET = 66;

// Least Def/SpD points (0..32) so every req survives at the given HP points.
function minDefPoints(reqs: SurviveReq[], base: PointBlock, nature: string, hpPoints: number, key: 'def' | 'spd'): number | null {
    if (reqs.length === 0) return 0;
    const hp = finalHp(base.hp, hpPoints);
    const defBase = key === 'def' ? base.def : base.spd;
    for (let d = 0; d <= MAX_POINTS; d++) {
        const defStat = finalStat(defBase, key, d, nature);
        if (reqs.every((r) => dmgRange(r.attackerStat, defStat, r.movePower, r.isStab, r.typeMult, r.isPhysical, hp).max < hp)) return d;
    }
    return null;
}

export function solveSpread(c: SolveConstraints, budget = DEFAULT_BUDGET): SolveResult {
    const points: PointBlock = { ...EMPTY_POINTS };
    const infeasible: string[] = [];

    // Speed: max over targets of the min points to outspeed.
    for (const s of c.speed) {
        const need = minSpeedPoints(c.base.spe, c.nature, s.targetSpe);
        if (need === null) infeasible.push(s.label);
        else points.spe = Math.max(points.spe, need);
    }

    // Offense: physical KOs bound Atk, special KOs bound SpA.
    for (const k of c.ko) {
        const r = minOffenseToKO({
            offBase: k.isPhysical ? c.base.atk : c.base.spa,
            offKey: k.isPhysical ? 'atk' : 'spa',
            nature: c.nature, currentPoints: 0,
            movePower: k.movePower, isStab: k.isStab, typeMult: k.typeMult, isPhysical: k.isPhysical,
            targetDef: k.targetDef, targetHp: k.targetHp,
        }, k.hits);
        if (r.points === null) infeasible.push(k.label);
        else if (k.isPhysical) points.atk = Math.max(points.atk, r.points);
        else points.spa = Math.max(points.spa, r.points);
    }

    // Survival: sweep HP; at each level take least Def (phys) and least SpD (spec).
    const phys = c.survive.filter((s) => s.isPhysical);
    const spec = c.survive.filter((s) => !s.isPhysical);
    if (phys.length > 0 || spec.length > 0) {
        let best: { hp: number; def: number; spd: number; total: number } | null = null;
        for (let hpPts = 0; hpPts <= MAX_POINTS; hpPts++) {
            const d = minDefPoints(phys, c.base, c.nature, hpPts, 'def');
            const s = minDefPoints(spec, c.base, c.nature, hpPts, 'spd');
            if (d === null || s === null) continue;
            const total = hpPts + d + s;
            if (best === null || total < best.total) best = { hp: hpPts, def: d, spd: s, total };
        }
        if (best === null) {
            // At least one survival req is impossible even at 32 HP / 32 def; label each such req.
            const hpMax = finalHp(c.base.hp, MAX_POINTS);
            for (const r of c.survive) {
                const key = r.isPhysical ? 'def' : 'spd';
                const defStat = finalStat(r.isPhysical ? c.base.def : c.base.spd, key, MAX_POINTS, c.nature);
                if (dmgRange(r.attackerStat, defStat, r.movePower, r.isStab, r.typeMult, r.isPhysical, hpMax).max >= hpMax) infeasible.push(r.label);
            }
        } else {
            points.hp = best.hp; points.def = best.def; points.spd = best.spd;
        }
    }

    const totalUsed = points.hp + points.atk + points.def + points.spa + points.spd + points.spe;
    const leftover = budget - totalUsed;
    return { feasible: infeasible.length === 0 && leftover >= 0, points, totalUsed, leftover, infeasible };
}
