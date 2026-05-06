import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { ItemsTable } from '../src/db/schema/items';
import { touchMetadata } from '../src/db/metadata-write';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const FETCH_CONCURRENCY = 8;
const INSERT_BATCH_SIZE = 100;

interface PokeApiListEntry {
    name: string;
    url: string;
}

interface PokeApiItem {
    id: number;
    name: string;
    cost: number;
    fling_power: number | null;
    category: { name: string };
    attributes: Array<{ name: string }>;
    names: Array<{ name: string; language: { name: string } }>;
    effect_entries: Array<{
        effect: string;
        short_effect: string;
        language: { name: string };
    }>;
}

// PokeAPI's `attributes` field is unreliable for is_holdable: many held items
// (Eviolite, Rocky Helmet, Assault Vest, etc.) have empty attributes, while
// pokeballs are tagged "holdable" despite not being held in normal play.
// Derive from category instead — these are the categories whose items can be
// held by a Pokemon during battle.
const HOLDABLE_CATEGORIES = new Set([
    'held-items',
    'choice',
    'type-enhancement',
    'type-protection',
    'mega-stones',
    'plates',
    'drives',
    'memories',
    'jewels',
    'bad-held-items',
    'in-a-pinch',
    'picky-healing',
    'scarves',
    'species-specific',
    'spelunking',
    'z-crystals',
]);

interface ItemRow {
    id: number;
    name: string;
    displayName: string;
    category: string;
    cost: number;
    flingPower: number | null;
    shortEffect: string | null;
    effect: string | null;
    isHoldable: number;
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

async function inBatches<T, R>(items: T[], batchSize: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((item, j) => fn(item, i + j)));
        for (let j = 0; j < batchResults.length; j++) {
            results[i + j] = batchResults[j];
        }
        const done = Math.min(i + batchSize, items.length);
        process.stdout.write(`\r  Fetched ${done}/${items.length}`);
    }
    process.stdout.write('\n');
    return results;
}

function pickEnglish<T extends { language: { name: string } }>(entries: T[]): T | undefined {
    return entries.find((e) => e.language.name === 'en');
}

function normaliseText(s: string | undefined): string | null {
    if (!s) return null;
    return s.replace(/\s+/g, ' ').trim() || null;
}

function transformItem(it: PokeApiItem): ItemRow {
    const englishName = pickEnglish(it.names)?.name ?? it.name;
    const englishEffect = pickEnglish(it.effect_entries);
    // Berries live in several categories ('medicine', 'in-a-pinch', 'picky-healing',
    // 'type-protection', 'baking-only', 'other', 'effort-drop'). All -berry items
    // are holdable, so catch them by slug suffix to avoid pulling unrelated 'medicine'
    // items (potions, antidotes) into the holdable set.
    const isHoldable =
        HOLDABLE_CATEGORIES.has(it.category.name) || it.name.endsWith('-berry') ? 1 : 0;
    return {
        id: it.id,
        name: it.name,
        displayName: englishName,
        category: it.category.name,
        cost: it.cost,
        flingPower: it.fling_power,
        shortEffect: normaliseText(englishEffect?.short_effect),
        effect: normaliseText(englishEffect?.effect),
        isHoldable,
    };
}

async function main() {
    console.log('Fetching item list from PokeAPI...');
    const list = await fetchWithRetry<{ count: number; results: PokeApiListEntry[] }>(
        `${POKEAPI_BASE}/item?limit=3000`
    );
    console.log(`Found ${list.results.length} items`);

    console.log(`Fetching details (concurrency ${FETCH_CONCURRENCY})...`);
    const details = await inBatches(list.results, FETCH_CONCURRENCY, async (entry) => {
        return fetchWithRetry<PokeApiItem>(entry.url);
    });

    const rows: ItemRow[] = details.map(transformItem);
    console.log(`Transformed ${rows.length} item rows`);

    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });
    const db = drizzle(conn, { mode: 'default' });

    await db.execute(sql`TRUNCATE TABLE items`);

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        await db.insert(ItemsTable).values(batch);
    }

    console.log(`Inserted ${rows.length} items`);
    await touchMetadata(db, 'last_pokeapi_sync');
    console.log('Run `npm run pc-overlay:items` next to apply Pokemon Champions deltas.');
    await conn.end();
}

main().catch((err) => {
    console.error('Sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
