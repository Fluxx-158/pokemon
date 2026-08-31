import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { inArray, sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { PokemonTable } from '../src/db/schema/pokemon';

// Derives each Pokemon's evolution stage from the PokeAPI evolution chains and
// writes it to pokemon.stage (baby | basic | stage1 | stage2 | mega).
//
//  - Stage = depth in the species' evolution chain. A baby pre-evo shifts the
//    rest of the chain down one (baby → basic → stage1 → stage2).
//  - Non-evolving species (legendaries, Ditto, single-stage mons) = basic.
//  - Regional forms inherit their base species' stage (we key off species_id,
//    which regional/alternate forms share with the base species).
//  - Mega forms are overridden to 'mega' (they carry the base species' id, so
//    this override must run last).
//
// Run AFTER sync:pokemon (+ pc-overlay:pokemon). Idempotent, safe to re-run.

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const FETCH_CONCURRENCY = 8;
const UPDATE_CHUNK_SIZE = 500;

type Stage = 'baby' | 'basic' | 'stage1' | 'stage2' | 'mega';

interface PokeApiListEntry {
    url: string;
}

interface ChainLink {
    is_baby: boolean;
    species: { name: string; url: string };
    evolves_to: ChainLink[];
}

interface EvolutionChain {
    id: number;
    chain: ChainLink;
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

async function inBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>, label: string): Promise<R[]> {
    const results: R[] = new Array(items.length);
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((item) => fn(item)));
        for (let j = 0; j < batchResults.length; j++) results[i + j] = batchResults[j];
        process.stdout.write(`\r  ${label}: ${Math.min(i + batchSize, items.length)}/${items.length}`);
    }
    process.stdout.write('\n');
    return results;
}

// Map a non-baby chain depth (after the baby shift) to a stage name.
function depthToStage(adjustedDepth: number): Stage {
    if (adjustedDepth <= 0) return 'basic';
    if (adjustedDepth === 1) return 'stage1';
    return 'stage2'; // clamp anything deeper (no PC mon evolves past stage 2)
}

// Walk a chain, recording each species' stage. A link flagged is_baby is 'baby';
// every other link is depth minus the baby offset (1 if the chain root is a baby).
function walkChain(link: ChainLink, depth: number, rootIsBaby: boolean, out: Map<number, Stage>): void {
    const sid = parseId(link.species.url);
    if (sid != null) {
        const stage: Stage = link.is_baby ? 'baby' : depthToStage(depth - (rootIsBaby ? 1 : 0));
        out.set(sid, stage);
    }
    for (const child of link.evolves_to) walkChain(child, depth + 1, rootIsBaby, out);
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

    console.log('Fetching evolution-chain list from PokeAPI...');
    const list = await fetchWithRetry<{ count: number; results: PokeApiListEntry[] }>(
        `${POKEAPI_BASE}/evolution-chain?limit=2000`,
    );
    console.log(`Found ${list.results.length} evolution chains. Fetching (concurrency ${FETCH_CONCURRENCY})...`);

    const chains = await inBatches(list.results, FETCH_CONCURRENCY, (entry) =>
        fetchWithRetry<EvolutionChain>(entry.url), 'chains');

    // species_id -> stage from the chains.
    const speciesStage = new Map<number, Stage>();
    for (const c of chains) {
        walkChain(c.chain, 0, c.chain.is_baby, speciesStage);
    }
    console.log(`Resolved stages for ${speciesStage.size} species.`);

    // Load our pokemon rows and assign each a stage.
    const [pokemonRows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT id, name, species_id, is_mega FROM pokemon',
    );

    const idsByStage: Record<Stage, number[]> = { baby: [], basic: [], stage1: [], stage2: [], mega: [] };
    const unresolved: string[] = [];
    for (const r of pokemonRows) {
        let stage: Stage;
        if (r.is_mega === 1) {
            stage = 'mega';
        } else {
            const resolved = speciesStage.get(r.species_id);
            if (resolved) {
                stage = resolved;
            } else {
                stage = 'basic';
                unresolved.push(`${r.name} (species ${r.species_id})`);
            }
        }
        idsByStage[stage].push(r.id);
    }

    // Apply per-stage in chunked IN-list updates.
    for (const stage of Object.keys(idsByStage) as Stage[]) {
        const ids = idsByStage[stage];
        for (let i = 0; i < ids.length; i += UPDATE_CHUNK_SIZE) {
            const chunk = ids.slice(i, i + UPDATE_CHUNK_SIZE);
            await db.update(PokemonTable).set({ stage }).where(inArray(PokemonTable.id, chunk));
        }
    }

    console.log('Stage counts:');
    for (const stage of Object.keys(idsByStage) as Stage[]) {
        console.log(`  ${stage.padEnd(7)} ${idsByStage[stage].length}`);
    }
    if (unresolved.length) {
        console.warn(`\n${unresolved.length} pokemon had no chain match (defaulted to basic):`);
        for (const u of unresolved.slice(0, 20)) console.warn(`  - ${u}`);
        if (unresolved.length > 20) console.warn(`  ... and ${unresolved.length - 20} more`);
    }

    await conn.end();
}

main().catch((err) => {
    console.error('Evolution-stage sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
