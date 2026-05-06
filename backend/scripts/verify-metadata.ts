import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });

    let pass = 0;
    let fail = 0;

    // Singleton invariant: exactly one row, id = 1.
    const [allRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM metadata');
    if (allRows.length !== 1) {
        console.log(`  [FAIL] expected 1 row in metadata, got ${allRows.length}`);
        fail++;
    } else if (allRows[0].id !== 1) {
        console.log(`  [FAIL] expected id=1, got id=${allRows[0].id}`);
        fail++;
    } else {
        console.log('  [OK  ] singleton row present (id=1)');
        pass++;
    }

    // Read the row.
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM metadata WHERE id = 1');
    if (rows.length === 0) {
        console.log('  [FAIL] metadata row id=1 missing — run `npm run seed:metadata`');
        fail++;
    } else {
        const r = rows[0];
        console.log('');
        console.log('Metadata snapshot:');
        console.log(`  last_pokeapi_sync:         ${r.last_pokeapi_sync ?? '(not yet stamped)'}`);
        console.log(`  last_pc_overlay_sync:      ${r.last_pc_overlay_sync ?? '(not yet stamped)'}`);
        console.log(`  last_mega_evolutions_seed: ${r.last_mega_evolutions_seed ?? '(not yet stamped)'}`);
        console.log(`  pc_patch_version:          ${r.pc_patch_version ?? '(not set)'}`);

        // Required columns are present (the queries above would have errored if not).
        const requiredCols = ['last_pokeapi_sync', 'last_pc_overlay_sync', 'last_mega_evolutions_seed', 'pc_patch_version'];
        for (const c of requiredCols) {
            if (!(c in r)) {
                console.log(`  [FAIL] column ${c} missing from row`);
                fail++;
            }
        }
    }

    console.log('');
    console.log(`${pass} passed, ${fail} failed`);

    await conn.end();
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
