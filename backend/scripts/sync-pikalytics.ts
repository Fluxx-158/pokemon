import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { loadConfig } from '../src/db/client';
import { runPikalyticsSync } from '../src/meta/pikalytics-sync';

// F2 phase 3 manual ingest: fetch Pikalytics per-battle win rate for the top
// meta species and merge it onto meta_species. Run AFTER sync:tournaments (it
// targets the species that sync already ranked). Data courtesy of Pikalytics.

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host, port: config.port, user: config.user,
        password: config.password, database: config.database,
    });
    const db = drizzle(conn, { mode: 'default' });

    const summary = await runPikalyticsSync(db, { log: (m) => console.log(m) });

    console.log('');
    console.log(`Updated win rate for ${summary.updated}/${summary.attempted} species (data date ${summary.dataDate ?? 'unknown'}).`);
    if (summary.missing.length) {
        console.warn(`\n${summary.missing.length} species had no parseable Pikalytics win rate (skipped):`);
        console.warn(`  ${summary.missing.slice(0, 40).join(', ')}${summary.missing.length > 40 ? ' …' : ''}`);
    }

    await conn.end();
}

main().catch((err) => {
    console.error('Pikalytics sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
