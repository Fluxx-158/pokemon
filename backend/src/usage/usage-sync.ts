// Shared championsbattledata.com usage ingestion. Used by both the CLI script
// (scripts/sync-usage.ts) and the in-app auto-refresh service so the logic
// lives in exactly one place.
//
// Source: https://championsbattledata.com/api
//   GET /api/index                         → { generatedAt, battleDataFolders:[Doubles,Singles], pokemon:[{name,...}] }
//   GET /api/battle/{Format}/{Name}        → { columns, rows:[{category,rank,name,percentage_value,...}] }
//
// The roster lists base species only (Mega is a battle transformation), with
// display names like "Alolan Ninetales" / "Aegislash Shield Forme" that need
// translating to our DB naming before they resolve to a pokemon.id.

import { sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { AbilitiesTable } from '../db/schema/abilities';
import { ItemsTable } from '../db/schema/items';
import { MovesTable } from '../db/schema/moves';
import { PokemonTable } from '../db/schema/pokemon';
import { PokemonUsageTable, type UsageCategory, type UsageFormat } from '../db/schema/usage';
import { normKey } from '../teams/team-parser';

const API_BASE = 'https://championsbattledata.com/api';
const FETCH_CONCURRENCY = 8;
const INSERT_BATCH_SIZE = 500;

export interface IndexResponse {
    generatedAt: string;
    // WARNING: this field's meaning changed upstream. It used to list the
    // formats (["Doubles","Singles"]); as of the M4 season it lists the SEASON
    // folder (["M4"]). Never treat it as the format list on its own.
    battleDataFolders: string[];
    seasons?: string[];
    pokemon: Array<{
        name: string;
        battleDataCsvs?: Array<{ season?: string; format?: string; path?: string }>;
    }>;
}

// The ranked-battle season the data covers (e.g. "M4"). "Current" is the
// rolling alias, so prefer the concrete label. NOT the regulation (M-B).
export function resolveSeason(index: IndexResponse): string | null {
    const fromFolders = (index.battleDataFolders ?? []).find((f) => f && f !== 'Current');
    if (fromFolders) return fromFolders;
    const fromSeasons = (index.seasons ?? []).find((s) => s && s !== 'Current');
    return fromSeasons ?? null;
}

const KNOWN_FORMATS = ['Doubles', 'Singles'] as const;

// Resolve the formats to ingest. Prefer what the roster actually advertises
// (battleDataCsvs[].format), fall back to battleDataFolders, then to the two
// known formats, so a season rollover can't silently yield "no formats".
export function resolveFormats(index: IndexResponse): string[] {
    const found = new Set<string>();
    for (const p of index.pokemon ?? []) {
        for (const c of p.battleDataCsvs ?? []) {
            if (c.format && (KNOWN_FORMATS as readonly string[]).includes(c.format)) found.add(c.format);
        }
    }
    for (const f of index.battleDataFolders ?? []) {
        if ((KNOWN_FORMATS as readonly string[]).includes(f)) found.add(f);
    }
    return found.size > 0 ? [...found] : [...KNOWN_FORMATS];
}

interface BattleRow {
    category: string;
    rank: number;
    name: string;
    percentage_value: number | null;
    stat_up?: string;
    stat_down?: string;
    hp_points?: number | string;
    attack_points?: number | string;
    defense_points?: number | string;
    sp_atk_points?: number | string;
    sp_def_points?: number | string;
    speed_points?: number | string;
}

interface BattleResponse {
    pokemon: string;
    format: string;
    rows: BattleRow[];
}

type UsageInsertRow = typeof PokemonUsageTable.$inferInsert;

export interface UsageSyncSummary {
    generatedAt: string;
    season: string | null;
    formats: string[];
    rosterCount: number;
    inserted: number;
    skippedSubjects: string[];     // roster names we couldn't map to a pokemon.id
    unresolvedRefs: string[];      // distinct "category:name" refs we couldn't resolve
    fetchFailures: string[];       // "pokemon/format" battle fetches that failed after retries
}

// If more than this fraction of battle fetches fail, abort WITHOUT touching the
// table, a rate-limited / flaky run must not replace good data with a partial set.
const MAX_FETCH_FAILURE_RATE = 0.05;

export interface UsageSyncOptions {
    fetchImpl?: typeof fetch;
    log?: (msg: string) => void;
    concurrency?: number;
}

const REGION_PREFIX: Record<string, string> = {
    Alolan: 'alola',
    Galarian: 'galar',
    Hisuian: 'hisui',
    Paldean: 'paldea',
};

// Gourgeist source "<size> Variety" → our form word.
const GOURGEIST_VARIETY: Record<string, string> = {
    'Jumbo Variety': 'super',
    'Large Variety': 'large',
    'Small Variety': 'small',
};

// Build an ordered list of candidate name strings for a roster entry, to try
// against the pokemon display-name map (then species map as a final fallback).
export function subjectCandidates(raw: string): string[] {
    const out = new Set<string>();
    out.add(raw);

    let s = raw;

    // Regional prefix → region word. Single-word species append at the end
    // ("Alolan Ninetales" → "Ninetales alola"); multi-word forms insert the
    // region after the species name ("Paldean Tauros Aqua Breed" →
    // "Tauros paldea Aqua Breed") to match our slug ordering.
    const regionMatch = s.match(/^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/);
    if (regionMatch) {
        const region = REGION_PREFIX[regionMatch[1]];
        const rest = regionMatch[2];
        const parts = rest.split(/\s+/);
        out.add(`${rest} ${region}`);
        if (parts.length > 1) out.add(`${parts[0]} ${region} ${parts.slice(1).join(' ')}`);
        s = `${rest} ${region}`;
    }

    // Gourgeist varieties.
    for (const [variety, word] of Object.entries(GOURGEIST_VARIETY)) {
        if (s.includes(variety)) out.add(s.replace(variety, word));
    }

    // Drop noise suffixes: "Aegislash Shield Forme" → "Aegislash Shield",
    // "Lycanroc Dusk Form" → "Lycanroc Dusk", "Palafin Zero Form" → "Palafin Zero".
    const stripped = s.replace(/\s+(Forme|Form|Variety|Pattern)$/i, '').trim();
    if (stripped !== s) out.add(stripped);

    // "Vivillon Fancy Pattern" → "Vivillon" (we collapse Vivillon patterns).
    const patternMatch = s.match(/^(.+?)\s+\w+\s+Pattern$/i);
    if (patternMatch) out.add(patternMatch[1]);

    return [...out];
}

interface Lookups {
    pokemon: Map<string, number>;        // normKey(displayName) -> id
    pokemonSpecies: Map<string, number>; // normKey(first word of default display) -> id
    moves: Map<string, number>;
    items: Map<string, number>;
    abilities: Map<string, number>;
}

async function loadLookups(db: MySql2Database<any>): Promise<Lookups> {
    const [pokRows, moveRows, itemRows, abilityRows] = await Promise.all([
        db.select({ id: PokemonTable.id, displayName: PokemonTable.displayName, isDefault: PokemonTable.isDefault }).from(PokemonTable),
        db.select({ id: MovesTable.id, displayName: MovesTable.displayName }).from(MovesTable),
        db.select({ id: ItemsTable.id, displayName: ItemsTable.displayName }).from(ItemsTable),
        db.select({ id: AbilitiesTable.id, displayName: AbilitiesTable.displayName }).from(AbilitiesTable),
    ]);

    pokRows.sort((a, b) => (b.isDefault - a.isDefault) || (a.id - b.id));
    const pokemon = new Map<string, number>();
    const pokemonSpecies = new Map<string, number>();
    for (const r of pokRows) {
        const key = normKey(r.displayName);
        if (!pokemon.has(key)) pokemon.set(key, r.id);
        if (r.isDefault === 1) {
            const speciesKey = normKey(r.displayName.split(/\s+/)[0]);
            if (speciesKey && !pokemonSpecies.has(speciesKey)) pokemonSpecies.set(speciesKey, r.id);
        }
    }

    const toMap = (rows: Array<{ id: number; displayName: string }>) => {
        const m = new Map<string, number>();
        for (const r of rows) m.set(normKey(r.displayName), r.id);
        return m;
    };

    return {
        pokemon,
        pokemonSpecies,
        moves: toMap(moveRows),
        items: toMap(itemRows),
        abilities: toMap(abilityRows),
    };
}

// Reusable species name -> pokemon.id resolver (candidate translation + species
// fallback), for other pipelines that ingest roster-style names (e.g. the
// Limitless tournament aggregation in F2 phase 2).
export async function loadPokemonResolver(db: MySql2Database<any>): Promise<(name: string) => number | null> {
    const lk = await loadLookups(db);
    return (name: string) => resolveSubject(name, lk);
}

function resolveSubject(rosterName: string, lk: Lookups): number | null {
    for (const cand of subjectCandidates(rosterName)) {
        const id = lk.pokemon.get(normKey(cand));
        if (id !== undefined) return id;
    }
    // Fall back to bare species (first word).
    const speciesId = lk.pokemonSpecies.get(normKey(rosterName.split(/\s+/)[0]));
    return speciesId ?? null;
}

function resolveRef(category: string, name: string, lk: Lookups): number | null {
    switch (category) {
        case 'move': return lk.moves.get(normKey(name)) ?? null;
        case 'held_item': return lk.items.get(normKey(name)) ?? null;
        case 'ability': return lk.abilities.get(normKey(name)) ?? null;
        case 'teammate':
            // Teammate names use the same roster display naming as subjects
            // (e.g. "Alolan Ninetales", "Hisuian Goodra"), so reuse the subject
            // resolver (candidate translation + species fallback).
            return resolveSubject(name, lk);
        default: return null; // stat_alignment / stat_points have no ref
    }
}

function toInt(v: number | string | undefined): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

async function fetchWithRetry<T>(fetchImpl: typeof fetch, url: string, maxRetries = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetchImpl(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
            return (await res.json()) as T;
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
    }
    throw lastErr;
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    for (let i = 0; i < items.length; i += size) {
        const batch = items.slice(i, i + size);
        const res = await Promise.all(batch.map((it) => fn(it)));
        for (let j = 0; j < res.length; j++) out[i + j] = res[j];
    }
    return out;
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set<UsageCategory>([
    'move', 'held_item', 'ability', 'stat_alignment', 'stat_points', 'teammate',
]);

export async function runUsageSync(db: MySql2Database<any>, opts: UsageSyncOptions = {}): Promise<UsageSyncSummary> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const log = opts.log ?? (() => {});
    const concurrency = opts.concurrency ?? FETCH_CONCURRENCY;

    log('Fetching championsbattledata /api/index…');
    const index = await fetchWithRetry<IndexResponse>(fetchImpl, `${API_BASE}/index`);
    const formats = resolveFormats(index);
    log(`generatedAt=${index.generatedAt}; roster=${index.pokemon.length}; formats=${formats.join(',')}`);

    const lk = await loadLookups(db);

    const skippedSubjects: string[] = [];
    const unresolvedRefs = new Set<string>();
    const rows: UsageInsertRow[] = [];

    // Build the (roster pokemon × format) work list, skipping unresolvable subjects once.
    const subjectIdByName = new Map<string, number>();
    for (const p of index.pokemon) {
        const id = resolveSubject(p.name, lk);
        if (id === null) skippedSubjects.push(p.name);
        else subjectIdByName.set(p.name, id);
    }

    const work: Array<{ rosterName: string; pokemonId: number; format: string }> = [];
    for (const [rosterName, pokemonId] of subjectIdByName) {
        for (const format of formats) work.push({ rosterName, pokemonId, format });
    }

    let done = 0;
    const fetchFailures: string[] = [];
    await inBatches(work, concurrency, async (w) => {
        const url = `${API_BASE}/battle/${encodeURIComponent(w.format)}/${encodeURIComponent(w.rosterName)}`;
        let battle: BattleResponse;
        try {
            battle = await fetchWithRetry<BattleResponse>(fetchImpl, url);
        } catch {
            // Track failures rather than silently skipping, a partial pull
            // would otherwise quietly replace good data (see abort guard below).
            fetchFailures.push(`${w.rosterName}/${w.format}`);
            return;
        }
        const fmt = w.format.toLowerCase() as UsageFormat;
        for (const r of battle.rows ?? []) {
            if (!VALID_CATEGORIES.has(r.category)) continue;
            const category = r.category as UsageCategory;
            const refId = resolveRef(category, r.name, lk);
            if (refId === null && (category === 'move' || category === 'held_item' || category === 'ability' || category === 'teammate') && r.name) {
                unresolvedRefs.add(`${category}:${r.name}`);
            }
            rows.push({
                pokemonId: w.pokemonId,
                format: fmt,
                category,
                rank: r.rank,
                name: r.name ?? '',
                refId,
                percentage: r.percentage_value ?? null,
                natureUp: category === 'stat_alignment' ? (r.stat_up || null) : null,
                natureDown: category === 'stat_alignment' ? (r.stat_down || null) : null,
                evHp: category === 'stat_points' ? toInt(r.hp_points) : null,
                evAtk: category === 'stat_points' ? toInt(r.attack_points) : null,
                evDef: category === 'stat_points' ? toInt(r.defense_points) : null,
                evSpa: category === 'stat_points' ? toInt(r.sp_atk_points) : null,
                evSpd: category === 'stat_points' ? toInt(r.sp_def_points) : null,
                evSpe: category === 'stat_points' ? toInt(r.speed_points) : null,
            });
        }
        done++;
        if (done % 40 === 0) log(`  fetched ${done}/${work.length} (pokemon × format)`);
    });

    // Abort before touching the table if too many fetches failed, preserves
    // the last good dataset against a rate-limited / flaky run.
    if (work.length > 0 && fetchFailures.length / work.length > MAX_FETCH_FAILURE_RATE) {
        throw new Error(
            `Aborting usage sync: ${fetchFailures.length}/${work.length} battle fetches failed `
            + `(>${MAX_FETCH_FAILURE_RATE * 100}%). Existing data left untouched. Retry later (source may be rate-limiting).`,
        );
    }

    // A run that produces nothing must NEVER wipe the table. This is the
    // backstop for upstream shape changes (e.g. the M4 season rollover, where
    // `battleDataFolders` stopped listing formats and we resolved zero work).
    if (rows.length === 0) {
        throw new Error(
            `Aborting usage sync: resolved 0 usage rows `
            + `(formats=[${formats.join(',')}], roster=${index.pokemon?.length ?? 0}, subjects=${subjectIdByName.size}). `
            + 'Existing data left untouched, the upstream API shape may have changed.',
        );
    }

    // Wholesale replace: truncate then batch insert.
    await db.execute(sql`TRUNCATE TABLE pokemon_usage`);
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        await db.insert(PokemonUsageTable).values(rows.slice(i, i + INSERT_BATCH_SIZE));
    }

    // Stamp freshness + which season the data covers.
    const season = resolveSeason(index);
    await db.execute(
        sql`UPDATE metadata SET last_usage_sync = NOW(), usage_source_generated_at = ${index.generatedAt}, usage_source_season = ${season} WHERE id = 1`,
    );

    return {
        generatedAt: index.generatedAt,
        season,
        formats,
        rosterCount: index.pokemon.length,
        inserted: rows.length,
        skippedSubjects,
        unresolvedRefs: [...unresolvedRefs].sort(),
        fetchFailures,
    };
}
