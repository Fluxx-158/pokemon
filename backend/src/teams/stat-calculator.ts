// Stat formulas for Pokemon Champions, level 50, with the 25-nature ±10% map.
//
// PC's EV system is NOT mainline — observed by reverse-engineering against
// team.md final stats:
//   Incineroar  base HP 95, EV 32, no-HP-nature  →  202
//   Greninja    base SpA 103, EV 32, neutral SpA →  155
//   Greninja    base Spe 122, EV 26, Timid (+)   →  184
//
// Mainline's EV/4 divisor doesn't reproduce these. What does:
//   final = floor((floor((2*base + iv) * level/100) + 5 + ev) * natureMod)
//
// i.e. each PC EV point is a direct stat-point bonus, applied BEFORE the
// nature multiplier. HP follows the same shape but with no nature mod and
// the +level+10 trailing term:
//   final_hp = floor((2*base + iv) * level/100) + level + 10 + ev
//
// IVs default to 31 (PC's format default) when callers pass null for ivs.

const LEVEL = 50;

export interface StatBlock {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
type StatKey = typeof STAT_KEYS[number];

// Each non-neutral nature boosts one stat (+10%) and drops another (−10%).
// Neutral natures (no plus/minus) are represented by both fields null.
interface NatureEffect {
    plus: Exclude<StatKey, 'hp'> | null;
    minus: Exclude<StatKey, 'hp'> | null;
}

const NATURES: Record<string, NatureEffect> = {
    hardy:    { plus: null,  minus: null },
    lonely:   { plus: 'atk', minus: 'def' },
    brave:    { plus: 'atk', minus: 'spe' },
    adamant:  { plus: 'atk', minus: 'spa' },
    naughty:  { plus: 'atk', minus: 'spd' },
    bold:     { plus: 'def', minus: 'atk' },
    docile:   { plus: null,  minus: null },
    relaxed:  { plus: 'def', minus: 'spe' },
    impish:   { plus: 'def', minus: 'spa' },
    lax:      { plus: 'def', minus: 'spd' },
    timid:    { plus: 'spe', minus: 'atk' },
    hasty:    { plus: 'spe', minus: 'def' },
    serious:  { plus: null,  minus: null },
    jolly:    { plus: 'spe', minus: 'spa' },
    naive:    { plus: 'spe', minus: 'spd' },
    modest:   { plus: 'spa', minus: 'atk' },
    mild:     { plus: 'spa', minus: 'def' },
    quiet:    { plus: 'spa', minus: 'spe' },
    bashful:  { plus: null,  minus: null },
    rash:     { plus: 'spa', minus: 'spd' },
    calm:     { plus: 'spd', minus: 'atk' },
    gentle:   { plus: 'spd', minus: 'def' },
    sassy:    { plus: 'spd', minus: 'spe' },
    careful:  { plus: 'spd', minus: 'spa' },
    quirky:   { plus: null,  minus: null },
};

export function natureEffect(name: string): NatureEffect {
    const effect = NATURES[name.trim().toLowerCase()];
    if (!effect) {
        // Unknown nature: treat as neutral. Logging upstream is fine.
        return { plus: null, minus: null };
    }
    return effect;
}

function rawAt50(base: number, iv: number): number {
    // floor((2*base + iv) * 50/100) — the mainline base term, EV-free.
    return Math.floor((2 * base + iv) * LEVEL / 100);
}

export function computeFinalStats(
    base: StatBlock,
    evs: StatBlock,
    ivs: StatBlock | null,
    nature: string,
): StatBlock {
    const iv = ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    const eff = natureEffect(nature);

    // HP: no nature multiplier, EV added directly.
    const hp = rawAt50(base.hp, iv.hp) + LEVEL + 10 + evs.hp;

    const calcOther = (key: Exclude<StatKey, 'hp'>): number => {
        const preNature = rawAt50(base[key], iv[key]) + 5 + evs[key];
        if (eff.plus === key) return Math.floor(preNature * 1.1);
        if (eff.minus === key) return Math.floor(preNature * 0.9);
        return preNature;
    };

    return {
        hp,
        atk: calcOther('atk'),
        def: calcOther('def'),
        spa: calcOther('spa'),
        spd: calcOther('spd'),
        spe: calcOther('spe'),
    };
}
