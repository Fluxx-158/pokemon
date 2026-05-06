import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { MovesTable } from '../src/db/schema/moves';
import { touchMetadata } from '../src/db/metadata-write';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const FETCH_CONCURRENCY = 8;
const INSERT_BATCH_SIZE = 100;

interface PokeApiListEntry {
    name: string;
    url: string;
}

interface PokeApiMove {
    id: number;
    name: string;
    accuracy: number | null;
    power: number | null;
    pp: number;
    priority: number;
    effect_chance: number | null;
    type: { name: string };
    damage_class: { name: string };
    target: { name: string };
    generation: { name: string; url: string };
    names: Array<{ name: string; language: { name: string } }>;
    effect_entries: Array<{
        effect: string;
        short_effect: string;
        language: { name: string };
    }>;
}

interface MoveRow {
    id: number;
    name: string;
    displayName: string;
    typeName: string;
    damageClass: string;
    power: number | null;
    accuracy: number | null;
    ppMainline: number;
    ppPc: number;
    priority: number;
    target: string;
    effectChance: number | null;
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
    return s.replace(/\s+/g, ' ').trim() || null;
}

function transformMove(m: PokeApiMove): MoveRow {
    const englishName = pickEnglish(m.names)?.name ?? m.name;
    const englishEffect = pickEnglish(m.effect_entries);
    const pp = m.pp ?? 0;
    return {
        id: m.id,
        name: m.name,
        displayName: englishName,
        typeName: m.type.name,
        damageClass: m.damage_class.name,
        power: m.power,
        accuracy: m.accuracy,
        ppMainline: pp,
        ppPc: pp,
        priority: m.priority,
        target: m.target.name,
        effectChance: m.effect_chance,
        shortEffect: normaliseText(englishEffect?.short_effect),
        effect: normaliseText(englishEffect?.effect),
        generation: parseGeneration(m.generation.url),
    };
}

async function main() {
    console.log('Fetching move list from PokeAPI...');
    const list = await fetchWithRetry<{ count: number; results: PokeApiListEntry[] }>(
        `${POKEAPI_BASE}/move?limit=2000`
    );
    console.log(`Found ${list.results.length} moves`);

    console.log(`Fetching details (concurrency ${FETCH_CONCURRENCY})...`);
    const details = await inBatches(list.results, FETCH_CONCURRENCY, async (entry) => {
        return fetchWithRetry<PokeApiMove>(entry.url);
    });

    const rows: MoveRow[] = details.map(transformMove);
    console.log(`Transformed ${rows.length} move rows`);

    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });
    const db = drizzle(conn, { mode: 'default' });

    await db.execute(sql`TRUNCATE TABLE moves`);

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        await db.insert(MovesTable).values(batch);
    }

    console.log(`Inserted ${rows.length} moves`);
    await touchMetadata(db, 'last_pokeapi_sync');
    console.log('Run `npm run pc-overlay:moves` next to apply Pokemon Champions deltas.');
    await conn.end();
}

main().catch((err) => {
    console.error('Sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
