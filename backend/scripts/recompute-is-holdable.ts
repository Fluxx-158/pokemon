// Recomputes the is_holdable column from the existing `category` data.
// Use this when the holdable-category list in sync-items.ts changes and you
// don't want to re-fetch all items from PokeAPI.
import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

// Must stay in sync with HOLDABLE_CATEGORIES in sync-items.ts.
const HOLDABLE_CATEGORIES = [
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
];

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });

    const placeholders = HOLDABLE_CATEGORIES.map(() => '?').join(',');
    // Mirrors sync-items.ts: holdable category OR -berry slug suffix.
    const [result] = await conn.query<mysql.ResultSetHeader>(
        `UPDATE items SET is_holdable = CASE
            WHEN category IN (${placeholders}) OR name LIKE '%-berry' THEN 1
            ELSE 0
        END`,
        HOLDABLE_CATEGORIES,
    );

    console.log(`Recomputed is_holdable for ${result.affectedRows} items`);
    await conn.end();
}

main().catch((err) => {
    console.error('Recompute failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
