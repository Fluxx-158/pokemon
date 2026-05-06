import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { AbilitiesTable } from '../src/db/schema/abilities';
import { touchMetadata } from '../src/db/metadata-write';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const FETCH_CONCURRENCY = 8;
const INSERT_BATCH_SIZE = 100;

interface PokeApiListEntry {
    name: string;
    url: string;
}

interface PokeApiAbility {
    id: number;
    name: string;
    is_main_series: boolean;
    generation: { name: string; url: string };
    names: Array<{ name: string; language: { name: string } }>;
    effect_entries: Array<{
        effect: string;
        short_effect: string;
        language: { name: string };
    }>;
}

interface AbilityRow {
    id: number;
    name: string;
    displayName: string;
    shortEffect: string | null;
    effect: string | null;
    generation: number | null;
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

function parseGeneration(genUrl: string): number | null {
    const match = genUrl.match(/\/generation\/(\d+)\/?$/);
    return match ? Number(match[1]) : null;
}

function pickEnglish<T extends { language: { name: string } }>(entries: T[]): T | undefined {
    return entries.find((e) => e.language.name === 'en');
}

function normaliseText(s: string | undefined): string | null {
    if (!s) return null;
    // PokeAPI text often has hard line breaks (\n, \f) embedded in the middle of sentences.
    // Collapse runs of whitespace into single spaces so text reads cleanly in tooling.
    return s.replace(/\s+/g, ' ').trim() || null;
}

function transformAbility(a: PokeApiAbility): AbilityRow {
    const englishName = pickEnglish(a.names)?.name ?? a.name;
    const englishEffect = pickEnglish(a.effect_entries);
    return {
        id: a.id,
        name: a.name,
        displayName: englishName,
        shortEffect: normaliseText(englishEffect?.short_effect),
        effect: normaliseText(englishEffect?.effect),
        generation: parseGeneration(a.generation.url),
    };
}

async function main() {
    console.log('Fetching ability list from PokeAPI...');
    const list = await fetchWithRetry<{ count: number; results: PokeApiListEntry[] }>(
        `${POKEAPI_BASE}/ability?limit=1000`
    );
    console.log(`Found ${list.results.length} abilities`);

    console.log(`Fetching details (concurrency ${FETCH_CONCURRENCY})...`);
    const details = await inBatches(list.results, FETCH_CONCURRENCY, async (entry) => {
        return fetchWithRetry<PokeApiAbility>(entry.url);
    });

    const rows: AbilityRow[] = details.map(transformAbility);
    console.log(`Transformed ${rows.length} ability rows`);

    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });
    const db = drizzle(conn, { mode: 'default' });

    await db.execute(sql`TRUNCATE TABLE abilities`);

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        await db.insert(AbilitiesTable).values(batch);
    }

    console.log(`Inserted ${rows.length} abilities`);
    await touchMetadata(db, 'last_pokeapi_sync');
    console.log('Run `npm run pc-overlay:abilities` next to apply Pokemon Champions deltas.');
    await conn.end();
}

main().catch((err) => {
    console.error('Sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
