import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';

// Idempotent: inserts the singleton row if missing, otherwise leaves the
// existing timestamps alone. Use to bootstrap a fresh database. Sync and
// overlay scripts will populate the timestamp columns on their next run.
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

    await db.execute(sql`
        INSERT INTO metadata (id, last_pokeapi_sync, last_pc_overlay_sync, last_mega_evolutions_seed, pc_patch_version)
        VALUES (1, NULL, NULL, NULL, NULL)
        ON DUPLICATE KEY UPDATE id = id
    `);

    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM metadata WHERE id = 1');
    console.log('metadata row:', rows[0]);

    await conn.end();
}

main().catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
