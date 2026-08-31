import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { loadConfig } from '../src/db/client';
import { runUsageSync } from '../src/usage/usage-sync';

// Manual usage ingest (layer 1 of the auto-refresh design). Also the initial
// seed. Pulls championsbattledata.com Doubles + Singles usage and replaces the
// pokemon_usage table. Run AFTER sync:pokemon (+ overlays) so names resolve.

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

    const summary = await runUsageSync(db, { log: (m) => console.log(m) });

    console.log('');
    console.log(`Inserted ${summary.inserted} usage rows across ${summary.formats.join(' + ')}.`);
    console.log(`Source generatedAt: ${summary.generatedAt}`);
    if (summary.skippedSubjects.length) {
        console.warn(`\n${summary.skippedSubjects.length} roster pokemon unresolved (no usage stored):`);
        console.warn(`  ${summary.skippedSubjects.join(', ')}`);
    }
    if (summary.fetchFailures.length) {
        console.warn(`\n${summary.fetchFailures.length} battle fetches failed (these pokemon×format have no rows this run):`);
        console.warn(`  ${summary.fetchFailures.slice(0, 30).join(', ')}${summary.fetchFailures.length > 30 ? ' …' : ''}`);
    }
    if (summary.unresolvedRefs.length) {
        console.warn(`\n${summary.unresolvedRefs.length} unresolved move/item/ability/teammate refs (stored with null ref_id):`);
        for (const r of summary.unresolvedRefs.slice(0, 40)) console.warn(`  - ${r}`);
        if (summary.unresolvedRefs.length > 40) console.warn(`  … and ${summary.unresolvedRefs.length - 40} more`);
    }

    await conn.end();
}

main().catch((err) => {
    console.error('Usage sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
