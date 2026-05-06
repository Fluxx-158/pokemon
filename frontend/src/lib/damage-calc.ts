// Pure damage-calc module. Implements the Gen 5+ damage formula with v1
// modifiers: STAB, type effectiveness, critical hit, the 0.85-1.00 random
// roll. Weather / screens / burn / item / ability modifiers will layer on
// in a later slice.
//
// Reference: Bulbapedia "Damage" article, Gen 5+ formula. Pokemon Champions
// follows the same shape — every step is floor()'d, matching the PC stat
// formula we already reverse-engineered for the team detail page.

import { capitalize } from './utils';

export interface DamageInput {
    level: number;
    attackingStat: number;   // attacker's Atk for physical, SpA for special
    defendingStat: number;   // defender's Def for physical, SpD for special
    movePower: number;       // base power; status moves (null) shouldn't be passed
    isStab: boolean;
    typeMultiplier: number;  // 0 / 0.25 / 0.5 / 1 / 2 / 4 (no-effect to 4x SE)
    isCritical: boolean;
    isPhysical?: boolean;    // needed for burn modifier; defaults to true (caller usually knows)

    // v2 modifiers — all optional, default to no-op.
    weatherMod?: number;     // 1.5 / 0.5 / 1.0 — caller computes from weather + moveType
    isBurned?: boolean;       // ×0.5 if isPhysical
    isSpread?: boolean;       // ×0.75 (doubles spread move that hits 2+ targets)
    screenMod?: number;       // 2/3 (doubles) / 0.5 (singles) / 1.0
    itemMod?: number;         // 1.2 (type-boost item like Charcoal) / 1.0
    adaptability?: boolean;   // STAB becomes ×2 instead of ×1.5
    multiscale?: boolean;     // ×0.5 (defender at full HP)
    filter?: boolean;         // ×0.75 — only if typeMultiplier > 1
    berryResist?: boolean;    // ×0.5 — caller pre-decides whether the berry triggers
}

// Reference table of the 18 type-resist berries. Keyed by canonical type name.
// Chilan is special: it always triggers on a Normal hit, not only SE; everything
// else only triggers when the hit is super-effective.
export interface TypeResistBerry {
    name: string;
    resistType: string;
    alwaysTrigger?: boolean;
}
export const TYPE_RESIST_BERRIES: TypeResistBerry[] = [
    { name: 'Occa Berry',   resistType: 'Fire' },
    { name: 'Passho Berry', resistType: 'Water' },
    { name: 'Wacan Berry',  resistType: 'Electric' },
    { name: 'Rindo Berry',  resistType: 'Grass' },
    { name: 'Yache Berry',  resistType: 'Ice' },
    { name: 'Chople Berry', resistType: 'Fighting' },
    { name: 'Kebia Berry',  resistType: 'Poison' },
    { name: 'Shuca Berry',  resistType: 'Ground' },
    { name: 'Coba Berry',   resistType: 'Flying' },
    { name: 'Payapa Berry', resistType: 'Psychic' },
    { name: 'Tanga Berry',  resistType: 'Bug' },
    { name: 'Charti Berry', resistType: 'Rock' },
    { name: 'Kasib Berry',  resistType: 'Ghost' },
    { name: 'Haban Berry',  resistType: 'Dragon' },
    { name: 'Colbur Berry', resistType: 'Dark' },
    { name: 'Babiri Berry', resistType: 'Steel' },
    { name: 'Roseli Berry', resistType: 'Fairy' },
    { name: 'Chilan Berry', resistType: 'Normal', alwaysTrigger: true },
];

// Defender abilities that nullify a move's damage by type. Keyed by move type
// the ability blocks (some abilities also have other side effects we ignore
// here — Storm Drain redirects, Volt Absorb heals, etc. — but the damage calc
// just zeroes the multiplier).
export const DEFENDER_IMMUNITY_ABILITIES: ReadonlyArray<{ name: string; immuneTo: string }> = [
    { name: 'Levitate',       immuneTo: 'Ground' },
    { name: 'Flash Fire',     immuneTo: 'Fire' },
    { name: 'Sap Sipper',     immuneTo: 'Grass' },
    { name: 'Storm Drain',    immuneTo: 'Water' },
    { name: 'Water Absorb',   immuneTo: 'Water' },
    { name: 'Volt Absorb',    immuneTo: 'Electric' },
    { name: 'Lightning Rod',  immuneTo: 'Electric' },
    { name: 'Motor Drive',    immuneTo: 'Electric' },
    { name: 'Dry Skin',       immuneTo: 'Water' },  // also takes more Fire, ignored here
];

export function weatherMultiplier(weather: string | undefined, moveType: string): number {
    const t = capitalize(moveType);
    if (weather === 'sun') {
        if (t === 'Fire') return 1.5;
        if (t === 'Water') return 0.5;
    } else if (weather === 'rain') {
        if (t === 'Water') return 1.5;
        if (t === 'Fire') return 0.5;
    }
    return 1.0;
}

export function screenMultiplier(
    screen: string | undefined,
    isPhysical: boolean,
    doubles: boolean,
): number {
    if (!screen || screen === 'none') return 1.0;
    const matches = screen === 'aurora_veil'
        || (screen === 'reflect' && isPhysical)
        || (screen === 'light_screen' && !isPhysical);
    if (!matches) return 1.0;
    return doubles ? 2 / 3 : 0.5;
}

export function defenderImmuneByAbility(abilityName: string | undefined, moveType: string): boolean {
    if (!abilityName || abilityName === 'none') return false;
    const t = capitalize(moveType);
    const entry = DEFENDER_IMMUNITY_ABILITIES.find((a) => a.name === abilityName);
    return entry !== undefined && entry.immuneTo === t;
}

export function berryTriggers(
    berryName: string | undefined,
    moveType: string,
    typeMultiplier: number,
): boolean {
    if (!berryName || berryName === 'none') return false;
    const entry = TYPE_RESIST_BERRIES.find((b) => b.name === berryName);
    if (!entry) return false;
    if (capitalize(moveType) !== entry.resistType) return false;
    return entry.alwaysTrigger === true || typeMultiplier > 1;
}

export interface DamageRange {
    rolls: readonly number[];          // 16 entries, 85% through 100%
    min: number;
    max: number;
    hpPercent: { min: number; max: number };
    // KO bands relative to the defender's HP. "Guaranteed" means even the
    // minimum roll achieves the threshold; "chance" means the maximum roll
    // achieves it but the min doesn't.
    ohko: 'guaranteed' | 'chance' | 'no';
    thko: 'guaranteed' | 'chance' | 'no'; // 2HKO; assumes a clean second hit, no chip
}

const ROLL_PERCENTS = [85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100] as const;

export function computeDamage(input: DamageInput, defenderMaxHp: number): DamageRange {
    if (defenderMaxHp <= 0) {
        return {
            rolls: ROLL_PERCENTS.map(() => 0),
            min: 0, max: 0,
            hpPercent: { min: 0, max: 0 },
            ohko: 'no', thko: 'no',
        };
    }

    // No-effect short-circuit before we burn cycles on the formula.
    if (input.typeMultiplier === 0) {
        return {
            rolls: ROLL_PERCENTS.map(() => 0),
            min: 0, max: 0,
            hpPercent: { min: 0, max: 0 },
            ohko: 'no', thko: 'no',
        };
    }

    // Base damage. The 2 + ((2*L/5 + 2) * P * A / D) / 50 expression with
    // floor at the end matches the canonical formula.
    const base = Math.floor(
        ((2 * input.level / 5 + 2) * input.movePower * input.attackingStat / input.defendingStat) / 50 + 2,
    );

    // Modifiers applied in canonical Gen 5+ order:
    //   targets → weather → crit → (random) → STAB → type → burn → other
    // The random roll is applied last via ROLL_PERCENTS so we can return the
    // full 16-roll spread; everything else floors at each step.
    let dmg = base;

    if (input.isSpread) {
        dmg = Math.floor(dmg * 0.75);
    }
    if (input.weatherMod !== undefined && input.weatherMod !== 1.0) {
        dmg = Math.floor(dmg * input.weatherMod);
    }
    if (input.isCritical) {
        dmg = Math.floor(dmg * 1.5);
    }
    // STAB — Adaptability bumps it to ×2.
    if (input.isStab) {
        const stabFactor = input.adaptability ? 2.0 : 1.5;
        dmg = Math.floor(dmg * stabFactor);
    }
    dmg = Math.floor(dmg * input.typeMultiplier);
    if (input.isBurned && input.isPhysical !== false) {
        dmg = Math.floor(dmg * 0.5);
    }

    // "Other" bucket — screens, items, abilities, berries. Order within the
    // bucket only matters at the integer-boundary; we apply in the order
    // most calcs document (screens first, items, then defender-side
    // dampeners) so cross-tool diffs are minimal.
    if (input.screenMod !== undefined && input.screenMod !== 1.0) {
        dmg = Math.floor(dmg * input.screenMod);
    }
    if (input.itemMod !== undefined && input.itemMod !== 1.0) {
        dmg = Math.floor(dmg * input.itemMod);
    }
    if (input.multiscale) {
        dmg = Math.floor(dmg * 0.5);
    }
    if (input.filter && input.typeMultiplier > 1) {
        dmg = Math.floor(dmg * 0.75);
    }
    if (input.berryResist) {
        dmg = Math.floor(dmg * 0.5);
    }

    const rolls = ROLL_PERCENTS.map((r) => Math.floor(dmg * r / 100));
    const min = rolls[0];
    const max = rolls[rolls.length - 1];

    const ohko = min >= defenderMaxHp ? 'guaranteed'
        : max >= defenderMaxHp ? 'chance'
        : 'no';
    const thko = (min * 2) >= defenderMaxHp ? 'guaranteed'
        : (max * 2) >= defenderMaxHp ? 'chance'
        : 'no';

    return {
        rolls,
        min,
        max,
        hpPercent: {
            min: (min / defenderMaxHp) * 100,
            max: (max / defenderMaxHp) * 100,
        },
        ohko,
        thko,
    };
}

// Helpers for the calc UI — derive default stats from a pokemon's base stats
// using the PC formula at level 50 with 31 IVs, 0 EVs, neutral nature. Keeps
// the calc usable without forcing the user to type stats in for every team.

export function defaultHp(baseHp: number, level = 50): number {
    return Math.floor((2 * baseHp + 31) * level / 100) + level + 10;
}

export function defaultStat(baseStat: number, level = 50): number {
    return Math.floor((2 * baseStat + 31) * level / 100) + 5;
}

// Compute the dual-type effectiveness from the attacker's move type and the
// defender's two type names. typeChart is the {attacker: {defender: number}}
// matrix already exposed at /types/chart.
export function typeEffectiveness(
    attackerMoveType: string,
    defenderType1: string,
    defenderType2: string | null,
    typeChart: Record<string, Record<string, number>>,
): number {
    const attacker = capitalize(attackerMoveType);
    const def1 = capitalize(defenderType1);
    const m1 = typeChart[attacker]?.[def1] ?? 1;
    if (!defenderType2) return m1;
    const def2 = capitalize(defenderType2);
    const m2 = typeChart[attacker]?.[def2] ?? 1;
    return m1 * m2;
}
