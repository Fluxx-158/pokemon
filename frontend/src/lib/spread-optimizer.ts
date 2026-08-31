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
