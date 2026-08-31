import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { loadConfig } from '../src/db/client';
import { verifyUsage } from '../src/usage/verify-usage';

// Thin CLI over the shared verifyUsage() checks (src/usage/verify-usage.ts), 
// the same ones the in-app auto-refresh runs after each sync. Exits non-zero on
// any failure so `sync:usage` (which chains this) gates on a bad ingest.

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host, port: config.port, user: config.user,
        password: config.password, database: config.database,
    });
    const db = drizzle(conn, { mode: 'default' });

    const { stats, checks, passed, failed } = await verifyUsage(db);

    console.log(`pokemon_usage rows:    ${stats.total}`);
    console.log(`distinct pokemon:      ${stats.distinctPokemon}`);
    console.log('by format:'); for (const f of stats.byFormat) console.log(`  ${f.format.padEnd(8)} ${f.count}`);
    console.log('by category:'); for (const c of stats.byCategory) console.log(`  ${c.category.padEnd(15)} ${c.count}`);
    console.log(`last_usage_sync:       ${stats.lastSync}`);
    console.log(`source generatedAt:    ${stats.generatedAt}`);
    console.log(`source season:         ${stats.season}`);
    console.log('ref resolution:');
    for (const r of stats.refResolution) console.log(`  ${r.category.padEnd(12)} ${r.resolved}/${r.total}`);

    console.log('\nChecks:');
    for (const c of checks) {
        console.log(`  ${c.ok ? '[OK  ]' : '[FAIL]'} ${c.label}${c.detail ? ': ' + c.detail : ''}`);
    }
    console.log(`\n${passed} passed, ${failed} failed`);

    await conn.end();
    if (failed > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
