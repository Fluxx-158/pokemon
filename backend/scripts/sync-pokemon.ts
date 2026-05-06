import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { PokemonTable, PokemonAbilitiesTable, PokemonMovesTable } from '../src/db/schema/pokemon';
import { touchMetadata } from '../src/db/metadata-write';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const FETCH_CONCURRENCY = 8;
const INSERT_BATCH_SIZE = 200;

interface PokeApiListEntry {
    name: string;
    url: string;
}

interface PokeApiPokemon {
    id: number;
    name: string;
    height: number;
    weight: number;
    is_default: boolean;
    species: { name: string; url: string };
    types: Array<{ slot: number; type: { name: string } }>;
    stats: Array<{ base_stat: number; stat: { name: string } }>;
    abilities: Array<{ slot: number; is_hidden: boolean; ability: { name: string; url: string } }>;
    moves: Array<{
        move: { name: string; url: string };
        version_group_details: Array<{
            level_learned_at: number;
            move_learn_method: { name: string };
            version_group: { name: string; url: string };
        }>;
    }>;
}

interface PokeApiSpecies {
    id: number;
    generation: { name: string; url: string };
}

interface PokemonRow {
    id: number;
    speciesId: number;
    name: string;
    displayName: string;
    type1Id: number;
    type2Id: number | null;
    baseHp: number;
    baseAtk: number;
    baseDef: number;
    baseSpa: number;
    baseSpd: number;
    baseSpe: number;
    bst: number;
    height: number;
    weight: number;
    generation: number | null;
    isDefault: number;
    isMega: number;
    isRegional: number;
    regionVariant: string | null;
}

interface AbilityRow {
    pokemonId: number;
    slot: number;
    abilityId: number;
    isHidden: number;
}

interface MoveRow {
    pokemonId: number;
    moveId: number;
    learnMethod: string;
    levelLearnedAt: number;
}

// Cosmetic / non-battle forms to skip. Megas, regional variants, origin/therian/crowned/zen/black/white/primal forms are KEPT.
const SKIP_SUFFIXES = ['-gmax', '-totem', '-eternamax', '-starter'];
const SKIP_PREFIXES = ['pokestar-'];
const SKIP_EXACT = new Set([
    'pikachu-cosplay', 'pikachu-rock-star', 'pikachu-belle', 'pikachu-pop-star',
    'pikachu-phd', 'pikachu-libre',
    'pikachu-original-cap', 'pikachu-hoenn-cap', 'pikachu-sinnoh-cap', 'pikachu-unova-cap',
    'pikachu-kalos-cap', 'pikachu-alola-cap', 'pikachu-partner-cap', 'pikachu-world-cap',
    'mimikyu-busted',
    'pichu-spiky-eared',
    'arceus-unknown',
    'sinistea-antique',
    'polteageist-antique',
    'eevee-starter',
]);
// Keep only minior-red-meteor (the default, slug "minior"). Skip all colour/core variants.
const MINIOR_SKIP_PATTERN = /^minior-(orange|yellow|green|blue|indigo|violet)-meteor$|^minior-(red|orange|yellow|green|blue|indigo|violet)$/;

function shouldSkip(slug: string): boolean {
    if (SKIP_EXACT.has(slug)) return true;
    if (SKIP_SUFFIXES.some((s) => slug.endsWith(s))) return true;
    if (SKIP_PREFIXES.some((s) => slug.startsWith(s))) return true;
    if (MINIOR_SKIP_PATTERN.test(slug)) return true;
    return false;
}

const REGION_VARIANTS = ['alola', 'galar', 'hisui', 'paldea'] as const;

function detectRegion(slug: string): string | null {
    for (const r of REGION_VARIANTS) {
        if (slug.endsWith(`-${r}`) || slug.includes(`-${r}-`)) return r;
    }
    return null;
}

function detectMega(slug: string): boolean {
    return slug.endsWith('-mega') || slug.endsWith('-mega-x') || slug.endsWith('-mega-y');
}

function parseGeneration(genUrl: string): number | null {
    const match = genUrl.match(/\/generation\/(\d+)\/?$/);
    return match ? Number(match[1]) : null;
}

function parseId(url: string): number | null {
    const match = url.match(/\/(\d+)\/?$/);
    return match ? Number(match[1]) : null;
}

async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
            return (await res.json()) as T;
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) {
                const delayMs = 500 * Math.pow(2, attempt);
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }
    throw lastErr;
}

async function inBatches<T, R>(items: T[], batchSize: number, fn: (item: T, index: number) => Promise<R>, label: string): Promise<R[]> {
    const results: R[] = new Array(items.length);
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((item, j) => fn(item, i + j)));
        for (let j = 0; j < batchResults.length; j++) {
            results[i + j] = batchResults[j];
        }
        const done = Math.min(i + batchSize, items.length);
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
    }
    process.stdout.write('\n');
    return results;
}

const STAT_KEYS: Record<string, keyof Pick<PokemonRow, 'baseHp' | 'baseAtk' | 'baseDef' | 'baseSpa' | 'baseSpd' | 'baseSpe'>> = {
    'hp': 'baseHp',
    'attack': 'baseAtk',
    'defense': 'baseDef',
    'special-attack': 'baseSpa',
    'special-defense': 'baseSpd',
    'speed': 'baseSpe',
};

function makeDisplayName(slug: string): string {
    // PokeAPI's pokemon endpoint doesn't return localized names like /pokemon-species does.
    // Build a display name from the slug: "charizard-mega-x" -> "Charizard Mega X".
    return slug
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
}

interface TypeLookup {
    [name: string]: number;
}
interface AbilityLookup {
    [name: string]: number;
}
interface MoveLookup {
    [name: string]: number;
}

function transformPokemon(
    p: PokeApiPokemon,
    speciesGen: number | null,
    typeIds: TypeLookup,
): { row: PokemonRow; abilities: AbilityRow[]; moves: MoveRow[]; missingAbilities: string[]; missingMoves: string[] } {
    const stats: Partial<Record<keyof PokemonRow, number>> = {};
    for (const s of p.stats) {
        const key = STAT_KEYS[s.stat.name];
        if (key) stats[key] = s.base_stat;
    }
    const baseHp = stats.baseHp ?? 0;
    const baseAtk = stats.baseAtk ?? 0;
    const baseDef = stats.baseDef ?? 0;
    const baseSpa = stats.baseSpa ?? 0;
    const baseSpd = stats.baseSpd ?? 0;
    const baseSpe = stats.baseSpe ?? 0;

    const t1 = p.types.find((t) => t.slot === 1)?.type.name;
    const t2 = p.types.find((t) => t.slot === 2)?.type.name ?? null;
    if (!t1) throw new Error(`Pokemon ${p.name} has no slot-1 type`);
    const type1Id = typeIds[t1];
    const type2Id = t2 ? typeIds[t2] : null;
    if (!type1Id) throw new Error(`Type ${t1} not found in types table for ${p.name}`);
    if (t2 && !type2Id) throw new Error(`Type ${t2} not found in types table for ${p.name}`);

    const region = detectRegion(p.name);
    const isMega = detectMega(p.name);
    const speciesId = parseId(p.species.url);
    if (!speciesId) throw new Error(`Could not parse species id from ${p.species.url}`);

    const row: PokemonRow = {
        id: p.id,
        speciesId,
        name: p.name,
        displayName: makeDisplayName(p.name),
        type1Id,
        type2Id,
        baseHp, baseAtk, baseDef, baseSpa, baseSpd, baseSpe,
        bst: baseHp + baseAtk + baseDef + baseSpa + baseSpd + baseSpe,
        height: p.height,
        weight: p.weight,
        generation: speciesGen,
        isDefault: p.is_default ? 1 : 0,
        isMega: isMega ? 1 : 0,
        isRegional: region ? 1 : 0,
        regionVariant: region,
    };

    return { row, abilities: [], moves: [], missingAbilities: [], missingMoves: [] };
}

function transformAbilities(p: PokeApiPokemon, abilityIds: AbilityLookup): { rows: AbilityRow[]; missing: string[] } {
    const rows: AbilityRow[] = [];
    const missing: string[] = [];
    const seen = new Set<number>();
    for (const a of p.abilities) {
        const id = abilityIds[a.ability.name];
        if (!id) {
            missing.push(`${p.name}:${a.ability.name}`);
            continue;
        }
        if (seen.has(a.slot)) continue; // dedupe slot
        seen.add(a.slot);
        rows.push({
            pokemonId: p.id,
            slot: a.slot,
            abilityId: id,
            isHidden: a.is_hidden ? 1 : 0,
        });
    }
    return { rows, missing };
}

function transformMoves(p: PokeApiPokemon, moveIds: MoveLookup): { rows: MoveRow[]; missing: string[] } {
    const rows: MoveRow[] = [];
    const missing: string[] = [];
    for (const m of p.moves) {
        const moveId = moveIds[m.move.name];
        if (!moveId) {
            missing.push(`${p.name}:${m.move.name}`);
            continue;
        }
        if (m.version_group_details.length === 0) continue;
        // Pick the latest version group (highest id parsed from URL).
        let best = m.version_group_details[0];
        let bestVgId = parseId(best.version_group.url) ?? 0;
        for (let i = 1; i < m.version_group_details.length; i++) {
            const candVgId = parseId(m.version_group_details[i].version_group.url) ?? 0;
            if (candVgId > bestVgId) {
                best = m.version_group_details[i];
                bestVgId = candVgId;
            }
        }
        rows.push({
            pokemonId: p.id,
            moveId,
            learnMethod: best.move_learn_method.name,
            levelLearnedAt: best.level_learned_at,
        });
    }
    return { rows, missing };
}

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });
    const db = drizzle(conn, { mode: 'default' });

    // Build lookup tables from already-synced data.
    // types table stores Title-cased names ("Grass") while PokeAPI returns lowercase ("grass").
    const [typeRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, name FROM types');
    const typeIds: TypeLookup = {};
    for (const r of typeRows) typeIds[r.name.toLowerCase()] = r.id;

    const [abilityRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, name FROM abilities');
    const abilityIds: AbilityLookup = {};
    for (const r of abilityRows) abilityIds[r.name] = r.id;

    const [moveRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, name FROM moves');
    const moveIds: MoveLookup = {};
    for (const r of moveRows) moveIds[r.name] = r.id;

    console.log(`Loaded lookups: ${Object.keys(typeIds).length} types, ${Object.keys(abilityIds).length} abilities, ${Object.keys(moveIds).length} moves`);

    console.log('Fetching pokemon list from PokeAPI...');
    const list = await fetchWithRetry<{ count: number; results: PokeApiListEntry[] }>(
        `${POKEAPI_BASE}/pokemon?limit=2000`
    );
    const allEntries = list.results;
    const skipped: string[] = [];
    const kept: PokeApiListEntry[] = [];
    for (const e of allEntries) {
        if (shouldSkip(e.name)) skipped.push(e.name);
        else kept.push(e);
    }
    console.log(`Fetched ${allEntries.length} entries; keeping ${kept.length}, skipping ${skipped.length} cosmetic forms`);

    console.log(`Fetching pokemon details (concurrency ${FETCH_CONCURRENCY})...`);
    const details = await inBatches(kept, FETCH_CONCURRENCY, async (entry) => {
        return fetchWithRetry<PokeApiPokemon>(entry.url);
    }, 'pokemon');

    // Dedupe species URLs and fetch generation.
    const speciesUrls = new Set<string>();
    for (const d of details) speciesUrls.add(d.species.url);
    console.log(`Fetching ${speciesUrls.size} unique species for generation info...`);
    const speciesArr = Array.from(speciesUrls);
    const speciesData = await inBatches(speciesArr, FETCH_CONCURRENCY, async (url) => {
        return fetchWithRetry<PokeApiSpecies>(url);
    }, 'species');
    const speciesGenById: Record<number, number | null> = {};
    for (let i = 0; i < speciesArr.length; i++) {
        const sid = parseId(speciesArr[i]);
        if (sid != null) speciesGenById[sid] = parseGeneration(speciesData[i].generation.url);
    }

    const pokemonRows: PokemonRow[] = [];
    const abilityRowsAll: AbilityRow[] = [];
    const moveRowsAll: MoveRow[] = [];
    const missingAbilities: string[] = [];
    const missingMoves: string[] = [];
    for (const p of details) {
        const sid = parseId(p.species.url);
        const gen = sid != null ? speciesGenById[sid] ?? null : null;
        const { row } = transformPokemon(p, gen, typeIds);
        pokemonRows.push(row);
        const aRes = transformAbilities(p, abilityIds);
        abilityRowsAll.push(...aRes.rows);
        missingAbilities.push(...aRes.missing);
        const mRes = transformMoves(p, moveIds);
        moveRowsAll.push(...mRes.rows);
        missingMoves.push(...mRes.missing);
    }
    console.log(`Transformed ${pokemonRows.length} pokemon, ${abilityRowsAll.length} ability rows, ${moveRowsAll.length} move rows`);
    if (missingAbilities.length) console.warn(`  ${missingAbilities.length} ability references not in DB (skipped)`);
    if (missingMoves.length) console.warn(`  ${missingMoves.length} move references not in DB (skipped)`);

    // FK order: pokemon_moves, pokemon_abilities depend on pokemon. Truncate children first.
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    await db.execute(sql`TRUNCATE TABLE pokemon_moves`);
    await db.execute(sql`TRUNCATE TABLE pokemon_abilities`);
    await db.execute(sql`TRUNCATE TABLE pokemon`);
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

    for (let i = 0; i < pokemonRows.length; i += INSERT_BATCH_SIZE) {
        const batch = pokemonRows.slice(i, i + INSERT_BATCH_SIZE);
        await db.insert(PokemonTable).values(batch);
    }
    console.log(`Inserted ${pokemonRows.length} pokemon`);

    for (let i = 0; i < abilityRowsAll.length; i += INSERT_BATCH_SIZE) {
        const batch = abilityRowsAll.slice(i, i + INSERT_BATCH_SIZE);
        await db.insert(PokemonAbilitiesTable).values(batch);
    }
    console.log(`Inserted ${abilityRowsAll.length} pokemon_abilities`);

    for (let i = 0; i < moveRowsAll.length; i += INSERT_BATCH_SIZE) {
        const batch = moveRowsAll.slice(i, i + INSERT_BATCH_SIZE);
        await db.insert(PokemonMovesTable).values(batch);
    }
    console.log(`Inserted ${moveRowsAll.length} pokemon_moves`);

    await touchMetadata(db, 'last_pokeapi_sync');
    console.log('Run `npm run pc-overlay:pokemon` next to apply Pokemon Champions deltas.');
    await conn.end();
}

main().catch((err) => {
    console.error('Sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
