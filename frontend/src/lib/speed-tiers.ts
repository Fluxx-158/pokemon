// Shared speed-tier engine (F4). Pure math, builds a unified speed ladder from
// your team members + the F2-derived meta speed list, applying interactive
// modifiers (Tailwind / Trick Room / weather+terrain speed abilities / Choice
// Scarf / paralysis / stat stages) and re-ranking. Used by the team Speed tab
// and the standalone /speed-tiers page.

// Ability → the field condition that doubles its holder's Speed.
const WEATHER_SPEED_ABILITY: Record<string, 'sun' | 'rain' | 'sand' | 'snow'> = {
    'Chlorophyll': 'sun',
    'Swift Swim': 'rain',
    'Sand Rush': 'sand',
    'Slush Rush': 'snow',
};
const TERRAIN_SPEED_ABILITY: Record<string, 'electric'> = {
    'Surge Surfer': 'electric',
};

export type Weather = 'none' | 'sun' | 'rain' | 'sand' | 'snow';
export type Terrain = 'none' | 'electric';

export interface GlobalMods {
    tailwind: boolean;   // ×2 to your team's side
    trickRoom: boolean;  // invert the ladder
    weather: Weather;
    terrain: Terrain;
}

export interface PerMonMods {
    scarf: boolean;       // ×1.5
    paralysis: boolean;   // ×0.5 (still halves in M-B)
    stage: number;        // -6..+6
}

export const EMPTY_PER_MON: PerMonMods = { scarf: false, paralysis: false, stage: 0 };

export interface SpeedEntry {
    key: string;
    pokemonId: number;
    displayName: string;
    type1: string;
    type2: string | null;
    side: 'team' | 'meta';
    /** Unmodified final Speed (team: actual EV-loaded; meta: common spread). */
    baseFinalSpe: number;
    /** Meta only: fastest common config (max-invest +Spe). */
    fastFinalSpe?: number;
    ability: string | null;
    scarfCommon?: boolean; // meta only, flags that its fast line may also be Scarf
    presence?: number;     // meta only, usage weight for breakpoint %
    perMon?: PerMonMods;   // team only, interactive toggles
}

function stageMultiplier(stage: number): number {
    if (stage >= 0) return (2 + stage) / 2;
    return 2 / (2 - stage);
}

function hasWeatherSpeed(ability: string | null, weather: Weather): boolean {
    return !!ability && weather !== 'none' && WEATHER_SPEED_ABILITY[ability] === weather;
}
function hasTerrainSpeed(ability: string | null, terrain: Terrain): boolean {
    return !!ability && terrain !== 'none' && TERRAIN_SPEED_ABILITY[ability] === terrain;
}

// Effective speed of a base value under the given conditions. Order of ops:
// stat stage → weather/terrain ability ×2 → Scarf ×1.5 → paralysis ×0.5 → Tailwind ×2.
export function effectiveSpeed(
    baseFinalSpe: number,
    ability: string | null,
    side: 'team' | 'meta',
    global: GlobalMods,
    per: PerMonMods,
): number {
    let s = baseFinalSpe * stageMultiplier(per.stage);
    if (hasWeatherSpeed(ability, global.weather) || hasTerrainSpeed(ability, global.terrain)) s *= 2;
    if (per.scarf) s *= 1.5;
    if (per.paralysis) s *= 0.5;
    if (global.tailwind && side === 'team') s *= 2;
    return Math.floor(s);
}

export interface LadderRow {
    entry: SpeedEntry;
    /** Effective speed used for ranking (team uses its perMon; meta uses common). */
    effective: number;
    /** Meta only: effective fast-benchmark speed. */
    effectiveFast?: number;
    speedBoosted: boolean; // a weather/terrain speed ability is active for it
}

export interface Ladder {
    rows: LadderRow[];
    trickRoom: boolean;
}

export function buildLadder(entries: SpeedEntry[], global: GlobalMods): Ladder {
    const rows: LadderRow[] = entries.map((entry) => {
        const per = entry.perMon ?? EMPTY_PER_MON;
        const effective = effectiveSpeed(entry.baseFinalSpe, entry.ability, entry.side, global, per);
        const effectiveFast = entry.fastFinalSpe !== undefined
            ? effectiveSpeed(entry.fastFinalSpe, entry.ability, entry.side, global, per)
            : undefined;
        const speedBoosted = hasWeatherSpeed(entry.ability, global.weather) || hasTerrainSpeed(entry.ability, global.terrain);
        return { entry, effective, effectiveFast, speedBoosted };
    });
    rows.sort((a, b) =>
        global.trickRoom ? a.effective - b.effective || a.entry.displayName.localeCompare(b.entry.displayName)
            : b.effective - a.effective || a.entry.displayName.localeCompare(b.entry.displayName),
    );
    return { rows, trickRoom: global.trickRoom };
}

// What share of the meta a team mon outspeeds (presence-weighted), using each
// meta mon's COMMON effective speed vs the team mon's effective speed.
export function outspeedShare(teamEffective: number, ladder: Ladder): number {
    let total = 0;
    let beaten = 0;
    for (const r of ladder.rows) {
        if (r.entry.side !== 'meta') continue;
        const w = r.entry.presence ?? 1;
        total += w;
        // Under Trick Room, slower is better, invert the comparison.
        const win = ladder.trickRoom ? r.effective > teamEffective : r.effective < teamEffective;
        if (win) beaten += w;
    }
    return total === 0 ? 0 : Math.round((beaten / total) * 100);
}
