import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { loadConfig } from '../src/db/client';
import { runTournamentSync } from '../src/meta/tournament-sync';

// F2 phase 2 manual ingest: aggregate recent Champions Reg M-B tournament
// decklists from play.limitlesstcg.com into meta_species (usage%, team win rate,
// teammate cores). Run AFTER sync:pokemon so species names resolve to ids.

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

    const summary = await runTournamentSync(db, { log: (m) => console.log(m) });

    console.log('');
    console.log(`Aggregated ${summary.totalDecklists} decklists from ${summary.tournamentsAggregated}/${summary.tournamentsConsidered} tournaments.`);
    console.log(`Stored Limitless stats for ${summary.speciesStored} species (doubles).`);
    if (summary.fetchFailures.length) {
        console.warn(`\n${summary.fetchFailures.length} tournament standings failed to fetch (skipped):`);
        console.warn(`  ${summary.fetchFailures.slice(0, 20).join(', ')}${summary.fetchFailures.length > 20 ? ' …' : ''}`);
    }
    if (summary.unresolved.length) {
        console.warn(`\n${summary.unresolved.length} species names did not resolve to a pokemon.id (no stats stored):`);
        console.warn(`  ${summary.unresolved.slice(0, 40).join(', ')}${summary.unresolved.length > 40 ? ' …' : ''}`);
    }

    await conn.end();
}

main().catch((err) => {
    console.error('Tournament sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
