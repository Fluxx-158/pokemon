import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { Datasource } from '../db/datasource';
import { AbilitiesTable } from '../db/schema/abilities';
import { MovesTable } from '../db/schema/moves';
import { PokemonAbilitiesTable, PokemonTable } from '../db/schema/pokemon';
import { TypesTable } from '../db/schema/types';
import { MetadataTable } from '../db/schema/metadata';
import { PokemonUsageTable, type UsageFormat } from '../db/schema/usage';
import { TypesService, type TypeChart } from '../types/types-service';
import { and } from 'drizzle-orm';
import { computeFinalStats, type StatBlock } from '../teams/stat-calculator';

// ---- Ability-aware defensive multipliers (mirror of frontend lib/team-analysis.ts) ----
const IMMUNE_ABILITY: Record<string, string> = {
    'Levitate': 'Ground', 'Flash Fire': 'Fire', 'Sap Sipper': 'Grass', 'Storm Drain': 'Water',
    'Water Absorb': 'Water', 'Volt Absorb': 'Electric', 'Lightning Rod': 'Electric',
    'Motor Drive': 'Electric', 'Dry Skin': 'Water', 'Eelevate': 'Ground',
};
const HALF_ABILITY: Record<string, string[]> = {
    'Thick Fat': ['Fire', 'Ice'], 'Heatproof': ['Fire'], 'Water Bubble': ['Fire'], 'Purifying Salt': ['Ghost'],
};
const FILTER_LIKE = new Set(['Filter', 'Solid Rock', 'Prism Armor']);

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

function pairMult(chart: TypeChart, atk: string, t1: string, t2: string | null): number {
    const m1 = chart[atk]?.[t1] ?? 1;
    const m2 = t2 ? (chart[atk]?.[t2] ?? 1) : 1;
    return m1 * m2;
}

function defensiveMultiplier(chart: TypeChart, t1: string, t2: string | null, ability: string | null, atk: string): number {
    if (ability && IMMUNE_ABILITY[ability] === atk) return 0;
    let mult = pairMult(chart, atk, t1, t2);
    if (ability && HALF_ABILITY[ability]?.includes(atk)) mult *= 0.5;
    if (ability && FILTER_LIKE.has(ability) && mult > 1) mult *= 0.75;
    return mult;
}

const ATTACKING_TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
    'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

const HIGH_USAGE_MOVE_PCT = 15; // a candidate's "common" offensive move types

interface Mon { id: number; name: string; displayName: string; t1: string; t2: string | null; baseSpe: number; pcAvailable: number; isMega: number; }

// Everything derived from the roster + a format's usage rows, shared by both
// partner suggestions and the meta-matrix endpoint.
interface UsageContext {
    monById: Map<number, Mon>;
    primaryAbility: Map<number, string>;     // fallback (slot 1)
    mostUsedAbility: Map<number, string>;    // from usage rank 1
    offTypesFor: (id: number) => string[];   // STAB + common move types
    teammateMentions: Map<number, number>;   // popularity proxy
    teammateEdges: Map<number, Map<number, number>>; // subject -> teammate -> rank
    metaMons: Set<number>;                   // mons with usage this format
    // Speed-tier signals (F4):
    spreadSpe: Map<number, number>;          // rank-1 stat_points Spe stat-points
    natureSpeMod: Map<number, number>;       // rank-1 nature's Spe multiplier (1.1 / 0.9 / 1)
    scarfCommon: Set<number>;                // Choice Scarf is a notable item
}

export interface PartnerMemberInput { pokemonId: number; ability: string | null; moveTypes: string[]; }
export interface PartnerRequest { format: UsageFormat; members: PartnerMemberInput[]; }
export interface WeightedWeakness { type: string; weakCount: number; threat: number; }
export interface PartnerSuggestion { pokemonId: number; name: string; displayName: string; assumedAbility: string | null; score: number; reasons: string[]; }
export interface PartnerResponse {
    format: UsageFormat;
    sourceGeneratedAt: string | null;
    sourceSeason: string | null;
    weightedWeaknesses: WeightedWeakness[];
    offensiveGaps: string[];
    suggestions: PartnerSuggestion[];
}

export interface MetaMon {
    pokemonId: number;
    name: string;
    displayName: string;
    type1: string;
    type2: string | null;
    presence: number;          // popularity weight (1 + teammate mentions)
    offensiveTypes: string[];  // STAB + common move types, what it threatens you with
}
export interface MetaResponse {
    format: UsageFormat;
    sourceGeneratedAt: string | null;
    sourceSeason: string | null;
    mons: MetaMon[];
}

export interface SpeedTierMon {
    pokemonId: number;
    name: string;
    displayName: string;
    type1: string;
    type2: string | null;
    baseSpe: number;
    commonSpe: number;       // most-common spread's Spe at L50
    fastSpe: number;         // fastest common config (max-invest +Spe)
    commonLabel: string;     // e.g. "Jolly · 32 Spe"
    speedAbility: string | null; // most-used ability, if it's a speed-relevant one
    scarfCommon: boolean;
    presence: number;
}
export interface SpeedTierResponse {
    format: UsageFormat;
    sourceGeneratedAt: string | null;
    sourceSeason: string | null;
    mons: SpeedTierMon[];
}

export interface MetaTargetMove { displayName: string; type: string; power: number; damageClass: string; }
export interface MetaTarget {
    pokemonId: number;
    name: string;
    displayName: string;
    type1: string;
    type2: string | null;
    ability: string | null;
    natureName: string;       // assumed nature
    spreadLabel: string;      // e.g. "252-style: HP 4 / Atk 32 / Spe 32" (champions points)
    finalStats: StatBlock;    // assumed final stats at L50
    moves: MetaTargetMove[];  // common damaging moves
    hasUsage: boolean;        // false → neutral/0 assumption
}

// Speed-relevant abilities (kept in sync with frontend lib/speed-tiers.ts).
const SPEED_ABILITY_NAMES = new Set([
    'Chlorophyll', 'Swift Swim', 'Sand Rush', 'Slush Rush', 'Surge Surfer',
    'Unburden', 'Speed Boost', 'Motor Drive', 'Weak Armor', 'Quick Feet',
]);

// L50 Champions Spe stat: floor((floor((2*base+31)*50/100)+5+ev) * natureMod).
function speAt50(base: number, ev: number, natureMod: number): number {
    const pre = Math.floor((2 * base + 31) * 50 / 100) + 5 + ev;
    return Math.floor(pre * natureMod);
}

@Injectable()
export class AnalysisService {
    constructor(
        private readonly datasource: Datasource,
        private readonly typesService: TypesService,
    ) {}

    private async loadContext(format: UsageFormat): Promise<UsageContext> {
        // Roster (+ both type names).
        const typeNameById = new Map<number, string>();
        {
            const rows = await this.datasource.db.select({ id: TypesTable.id, name: TypesTable.name }).from(TypesTable);
            for (const r of rows) typeNameById.set(r.id, r.name);
        }
        const pokRows = await this.datasource.db
            .select({
                id: PokemonTable.id, name: PokemonTable.name, displayName: PokemonTable.displayName,
                type1Id: PokemonTable.type1Id, type2Id: PokemonTable.type2Id, baseSpe: PokemonTable.baseSpe,
                pcAvailable: PokemonTable.pcAvailable, isMega: PokemonTable.isMega,
            })
            .from(PokemonTable);
        const monById = new Map<number, Mon>();
        for (const r of pokRows) {
            monById.set(r.id, {
                id: r.id, name: r.name, displayName: r.displayName,
                t1: typeNameById.get(r.type1Id) ?? 'Normal',
                t2: r.type2Id != null ? typeNameById.get(r.type2Id) ?? null : null,
                baseSpe: r.baseSpe,
                pcAvailable: r.pcAvailable, isMega: r.isMega,
            });
        }

        // Fallback primary ability (slot 1).
        const primaryAbility = new Map<number, string>();
        {
            const rows = await this.datasource.db
                .select({ pokemonId: PokemonAbilitiesTable.pokemonId, displayName: AbilitiesTable.displayName })
                .from(PokemonAbilitiesTable)
                .innerJoin(AbilitiesTable, eq(AbilitiesTable.id, PokemonAbilitiesTable.abilityId))
                .orderBy(asc(PokemonAbilitiesTable.pokemonId), asc(PokemonAbilitiesTable.slot));
            for (const r of rows) if (!primaryAbility.has(r.pokemonId)) primaryAbility.set(r.pokemonId, r.displayName);
        }

        // Move id -> type name, DAMAGING moves only (power != null). Excludes
        // status moves so high-usage Protect/Tailwind/etc. don't masquerade as
        // offensive coverage.
        const moveTypeById = new Map<number, string>();
        {
            const rows = await this.datasource.db
                .select({ id: MovesTable.id, typeName: MovesTable.typeName, power: MovesTable.power })
                .from(MovesTable);
            for (const r of rows) if (r.power != null) moveTypeById.set(r.id, cap(r.typeName));
        }

        // Usage rows for the format.
        const usageRows = await this.datasource.db
            .select({
                pokemonId: PokemonUsageTable.pokemonId, category: PokemonUsageTable.category,
                rank: PokemonUsageTable.rank, name: PokemonUsageTable.name,
                refId: PokemonUsageTable.refId, percentage: PokemonUsageTable.percentage,
                evSpe: PokemonUsageTable.evSpe, natureUp: PokemonUsageTable.natureUp, natureDown: PokemonUsageTable.natureDown,
            })
            .from(PokemonUsageTable)
            .where(eq(PokemonUsageTable.format, format));

        const mostUsedAbility = new Map<number, string>();
        const offensiveTypes = new Map<number, Set<string>>();
        const teammateMentions = new Map<number, number>();
        const teammateEdges = new Map<number, Map<number, number>>();
        const metaMons = new Set<number>();
        const spreadSpe = new Map<number, number>();
        const natureSpeMod = new Map<number, number>();
        const scarfCommon = new Set<number>();

        for (const r of usageRows) {
            metaMons.add(r.pokemonId);
            if (r.category === 'ability') {
                if (r.rank === 1 && !mostUsedAbility.has(r.pokemonId)) mostUsedAbility.set(r.pokemonId, r.name);
            } else if (r.category === 'move') {
                if (r.refId != null && (r.percentage ?? 0) >= HIGH_USAGE_MOVE_PCT) {
                    const ty = moveTypeById.get(r.refId);
                    if (ty) {
                        const set = offensiveTypes.get(r.pokemonId) ?? new Set<string>();
                        set.add(ty);
                        offensiveTypes.set(r.pokemonId, set);
                    }
                }
            } else if (r.category === 'teammate' && r.refId != null) {
                teammateMentions.set(r.refId, (teammateMentions.get(r.refId) ?? 0) + 1);
                const edges = teammateEdges.get(r.pokemonId) ?? new Map<number, number>();
                if (!edges.has(r.refId)) edges.set(r.refId, r.rank);
                teammateEdges.set(r.pokemonId, edges);
            } else if (r.category === 'stat_points') {
                if (r.rank === 1 && !spreadSpe.has(r.pokemonId)) spreadSpe.set(r.pokemonId, r.evSpe ?? 0);
            } else if (r.category === 'stat_alignment') {
                if (r.rank === 1 && !natureSpeMod.has(r.pokemonId)) {
                    const mod = r.natureUp === 'Speed' ? 1.1 : r.natureDown === 'Speed' ? 0.9 : 1;
                    natureSpeMod.set(r.pokemonId, mod);
                }
            } else if (r.category === 'held_item') {
                if (r.name === 'Choice Scarf' && (r.percentage ?? 0) >= 10) scarfCommon.add(r.pokemonId);
            }
        }

        const offTypesFor = (id: number): string[] => {
            const mon = monById.get(id);
            const s = new Set<string>(offensiveTypes.get(id) ?? []);
            if (mon) { s.add(mon.t1); if (mon.t2) s.add(mon.t2); }
            return [...s];
        };

        return { monById, primaryAbility, mostUsedAbility, offTypesFor, teammateMentions, teammateEdges, metaMons, spreadSpe, natureSpeMod, scarfCommon };
    }

    // Usage-data provenance: source timestamp + the ranked season it covers.
    private async sourceInfo(): Promise<{ generatedAt: string | null; season: string | null }> {
        const meta = await this.datasource.db
            .select({ generatedAt: MetadataTable.usageSourceGeneratedAt, season: MetadataTable.usageSourceSeason })
            .from(MetadataTable).where(eq(MetadataTable.id, 1)).limit(1);
        return { generatedAt: meta[0]?.generatedAt ?? null, season: meta[0]?.season ?? null };
    }

    async suggestPartners(req: PartnerRequest): Promise<PartnerResponse> {
        const format = req.format;
        const chart = await this.typesService.getChart();
        const ctx = await this.loadContext(format);
        const { monById, mostUsedAbility, primaryAbility, offTypesFor, teammateMentions, teammateEdges, metaMons } = ctx;

        // Meta threat weight per attacking type.
        const rawThreat: Record<string, number> = {};
        for (const t of ATTACKING_TYPES) rawThreat[t] = 0;
        for (const id of metaMons) {
            const presence = 1 + (teammateMentions.get(id) ?? 0);
            for (const ot of offTypesFor(id)) if (rawThreat[ot] !== undefined) rawThreat[ot] += presence;
        }
        const maxThreat = Math.max(1, ...Object.values(rawThreat));
        const threat: Record<string, number> = {};
        for (const t of ATTACKING_TYPES) threat[t] = rawThreat[t] / maxThreat;

        // Team defensive profile + offensive gaps.
        const teamIds = new Set(req.members.map((m) => m.pokemonId));
        const minWeak = req.members.length <= 2 ? 1 : 2;
        const weakCount: Record<string, number> = {};
        for (const t of ATTACKING_TYPES) {
            let n = 0;
            for (const mem of req.members) {
                const mon = monById.get(mem.pokemonId);
                if (mon && defensiveMultiplier(chart, mon.t1, mon.t2, mem.ability, t) >= 2) n++;
            }
            weakCount[t] = n;
        }
        const need: Record<string, number> = {};
        for (const t of ATTACKING_TYPES) need[t] = weakCount[t] >= minWeak ? threat[t] : 0;

        const teamOffTypes = new Set<string>();
        for (const mem of req.members) for (const mt of mem.moveTypes) teamOffTypes.add(cap(mt));
        const offensiveGaps = ATTACKING_TYPES.filter((d) => ![...teamOffTypes].some((o) => (chart[o]?.[d] ?? 1) > 1));

        const weightedWeaknesses: WeightedWeakness[] = ATTACKING_TYPES
            .map((t) => ({ type: t, weakCount: weakCount[t], threat: Math.round(threat[t] * 100) / 100 }))
            .filter((w) => w.weakCount >= minWeak)
            .sort((a, b) => (b.weakCount * b.threat) - (a.weakCount * a.threat) || b.threat - a.threat);

        interface Raw { mon: Mon; ability: string | null; def: number; off: number; syn: number; via: number; patched: string[]; filled: string[]; synWith: string[]; }
        const raws: Raw[] = [];
        for (const mon of monById.values()) {
            if (mon.pcAvailable !== 1 || mon.isMega === 1 || teamIds.has(mon.id)) continue;
            const ability = mostUsedAbility.get(mon.id) ?? primaryAbility.get(mon.id) ?? null;
            let def = 0; const patched: string[] = [];
            for (const t of ATTACKING_TYPES) {
                if (need[t] <= 0) continue;
                if (defensiveMultiplier(chart, mon.t1, mon.t2, ability, t) < 1) { def += need[t]; patched.push(t); }
            }
            const cOff = offTypesFor(mon.id);
            let off = 0; const filled: string[] = [];
            for (const g of offensiveGaps) {
                if (cOff.some((o) => (chart[o]?.[g] ?? 1) > 1)) { off += threat[g] + 0.3; filled.push(g); }
            }
            let syn = 0; const synWith: string[] = [];
            for (const mem of req.members) {
                const rank = teammateEdges.get(mem.pokemonId)?.get(mon.id);
                if (rank != null) { syn += (11 - rank) / 10; const nm = monById.get(mem.pokemonId)?.displayName; if (nm) synWith.push(nm); }
            }
            const via = 1 + (teammateMentions.get(mon.id) ?? 0);
            raws.push({ mon, ability, def, off, syn, via, patched, filled, synWith });
        }

        const maxOf = (sel: (r: Raw) => number) => Math.max(1, ...raws.map(sel));
        const mDef = maxOf((r) => r.def), mOff = maxOf((r) => r.off), mSyn = maxOf((r) => r.syn), mVia = maxOf((r) => r.via);

        const scored = raws.map((r) => {
            const defN = r.def / mDef, offN = r.off / mOff, synN = r.syn / mSyn, viaN = r.via / mVia;
            const score = 0.45 * defN + 0.25 * offN + 0.20 * synN + 0.10 * viaN;
            const reasons: string[] = [];
            if (r.patched.length) reasons.push(`Resists ${r.patched.slice(0, 3).join(', ')} (your team's meta weakness)`);
            if (r.filled.length) reasons.push(`Adds super-effective ${r.filled.slice(0, 3).join(', ')} coverage`);
            if (r.synWith.length) reasons.push(`Common teammate of ${[...new Set(r.synWith)].slice(0, 2).join(', ')}`);
            if (viaN >= 0.6 && !r.synWith.length) reasons.push('High meta presence');
            return {
                pokemonId: r.mon.id, name: r.mon.name, displayName: r.mon.displayName,
                assumedAbility: r.ability, score: Math.round(score * 1000) / 1000, reasons,
            };
        });
        scored.sort((a, b) => b.score - a.score);

        const src = await this.sourceInfo();
        return {
            format,
            sourceGeneratedAt: src.generatedAt,
            sourceSeason: src.season,
            weightedWeaknesses: weightedWeaknesses.slice(0, 8),
            offensiveGaps,
            suggestions: scored.filter((s) => s.reasons.length > 0).slice(0, 8),
        };
    }

    // Top-N meta Pokemon (by popularity proxy) with their STAB + common move
    // types. The threaten/safe matrix itself is computed client-side from this
    // (reusing the shared team-analysis lib).
    async getMeta(format: UsageFormat, limit = 30): Promise<MetaResponse> {
        const ctx = await this.loadContext(format);
        const { monById, offTypesFor, teammateMentions, metaMons } = ctx;

        const mons: MetaMon[] = [...metaMons]
            .map((id) => ({ id, mon: monById.get(id), presence: 1 + (teammateMentions.get(id) ?? 0) }))
            .filter((x): x is { id: number; mon: Mon; presence: number } => x.mon !== undefined && x.mon.isMega === 0)
            .sort((a, b) => b.presence - a.presence)
            .slice(0, limit)
            .map((x) => ({
                pokemonId: x.id,
                name: x.mon.name,
                displayName: x.mon.displayName,
                type1: x.mon.t1,
                type2: x.mon.t2,
                presence: x.presence,
                offensiveTypes: offTypesFor(x.id),
            }));

        const src = await this.sourceInfo();
        return { format, sourceGeneratedAt: src.generatedAt, sourceSeason: src.season, mons };
    }

    // A single target's assumed profile for the spread optimizer (F7): final
    // stats from its most-common spread + nature, types, ability, and common
    // damaging moves. Falls back to neutral / 0-EV when the mon has no usage.
    async getMetaTarget(format: UsageFormat, pokemonId: number): Promise<MetaTarget | null> {
        const pk = await this.datasource.db
            .select({
                id: PokemonTable.id, name: PokemonTable.name, displayName: PokemonTable.displayName,
                type1Id: PokemonTable.type1Id, type2Id: PokemonTable.type2Id,
                baseHp: PokemonTable.baseHp, baseAtk: PokemonTable.baseAtk, baseDef: PokemonTable.baseDef,
                baseSpa: PokemonTable.baseSpa, baseSpd: PokemonTable.baseSpd, baseSpe: PokemonTable.baseSpe,
            })
            .from(PokemonTable).where(eq(PokemonTable.id, pokemonId)).limit(1);
        if (pk.length === 0) return null;
        const p = pk[0];

        const typeNameById = new Map<number, string>();
        {
            const rows = await this.datasource.db.select({ id: TypesTable.id, name: TypesTable.name }).from(TypesTable);
            for (const r of rows) typeNameById.set(r.id, r.name);
        }
        const moveById = new Map<number, { displayName: string; type: string; power: number | null; damageClass: string }>();
        {
            const rows = await this.datasource.db
                .select({ id: MovesTable.id, displayName: MovesTable.displayName, type: MovesTable.typeName, power: MovesTable.power, damageClass: MovesTable.damageClass })
                .from(MovesTable);
            for (const r of rows) moveById.set(r.id, { displayName: r.displayName, type: cap(r.type), power: r.power, damageClass: r.damageClass });
        }

        const usage = await this.datasource.db
            .select({
                category: PokemonUsageTable.category, rank: PokemonUsageTable.rank, name: PokemonUsageTable.name,
                refId: PokemonUsageTable.refId, percentage: PokemonUsageTable.percentage,
                evHp: PokemonUsageTable.evHp, evAtk: PokemonUsageTable.evAtk, evDef: PokemonUsageTable.evDef,
                evSpa: PokemonUsageTable.evSpa, evSpd: PokemonUsageTable.evSpd, evSpe: PokemonUsageTable.evSpe,
            })
            .from(PokemonUsageTable)
            .where(and(eq(PokemonUsageTable.format, format), eq(PokemonUsageTable.pokemonId, pokemonId)));

        const hasUsage = usage.length > 0;
        let evs: StatBlock = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        let natureName = 'Hardy';
        let ability: string | null = null;
        const moves: MetaTargetMove[] = [];

        const spread = usage.find((u) => u.category === 'stat_points' && u.rank === 1);
        if (spread) {
            evs = {
                hp: spread.evHp ?? 0, atk: spread.evAtk ?? 0, def: spread.evDef ?? 0,
                spa: spread.evSpa ?? 0, spd: spread.evSpd ?? 0, spe: spread.evSpe ?? 0,
            };
        }
        const nature = usage.find((u) => u.category === 'stat_alignment' && u.rank === 1);
        if (nature) natureName = nature.name;
        const ab = usage.find((u) => u.category === 'ability' && u.rank === 1);
        if (ab) ability = ab.name;

        for (const u of usage.filter((u) => u.category === 'move').sort((a, b) => a.rank - b.rank)) {
            if (u.refId == null) continue;
            const mv = moveById.get(u.refId);
            if (mv && mv.power != null) moves.push({ displayName: mv.displayName, type: mv.type, power: mv.power, damageClass: mv.damageClass });
        }

        const base: StatBlock = {
            hp: p.baseHp, atk: p.baseAtk, def: p.baseDef, spa: p.baseSpa, spd: p.baseSpd, spe: p.baseSpe,
        };
        const finalStats = computeFinalStats(base, evs, null, natureName);
        const spreadLabel = `${natureName} · HP ${evs.hp}/Atk ${evs.atk}/Def ${evs.def}/SpA ${evs.spa}/SpD ${evs.spd}/Spe ${evs.spe}`;

        return {
            pokemonId: p.id, name: p.name, displayName: p.displayName,
            type1: typeNameById.get(p.type1Id) ?? 'Normal',
            type2: p.type2Id != null ? typeNameById.get(p.type2Id) ?? null : null,
            ability, natureName, spreadLabel, finalStats, moves, hasUsage,
        };
    }

    // Real meta speed tiers from F2: each mon's most-common-spread speed plus a
    // fast benchmark (max-invest +Spe). The frontend applies live modifiers.
    async getSpeedTiers(format: UsageFormat, limit = 40): Promise<SpeedTierResponse> {
        const ctx = await this.loadContext(format);
        const { monById, mostUsedAbility, teammateMentions, metaMons, spreadSpe, natureSpeMod, scarfCommon } = ctx;

        const mons: SpeedTierMon[] = [...metaMons]
            .map((id) => ({ id, mon: monById.get(id), presence: 1 + (teammateMentions.get(id) ?? 0) }))
            .filter((x): x is { id: number; mon: Mon; presence: number } => x.mon !== undefined && x.mon.isMega === 0)
            .sort((a, b) => b.presence - a.presence)
            .slice(0, limit)
            .map((x) => {
                const ev = spreadSpe.get(x.id) ?? 0;
                const natureMod = natureSpeMod.get(x.id) ?? 1;
                const commonSpe = speAt50(x.mon.baseSpe, ev, natureMod);
                const fastSpe = speAt50(x.mon.baseSpe, 32, 1.1);
                const natLabel = natureMod === 1.1 ? '+Spe' : natureMod === 0.9 ? '−Spe' : 'neutral';
                const ability = mostUsedAbility.get(x.id) ?? null;
                return {
                    pokemonId: x.id,
                    name: x.mon.name,
                    displayName: x.mon.displayName,
                    type1: x.mon.t1,
                    type2: x.mon.t2,
                    baseSpe: x.mon.baseSpe,
                    commonSpe,
                    fastSpe,
                    commonLabel: `${natLabel} · ${ev} Spe`,
                    speedAbility: ability && SPEED_ABILITY_NAMES.has(ability) ? ability : null,
                    scarfCommon: scarfCommon.has(x.id),
                    presence: x.presence,
                };
            });

        const src = await this.sourceInfo();
        return { format, sourceGeneratedAt: src.generatedAt, sourceSeason: src.season, mons };
    }
}
