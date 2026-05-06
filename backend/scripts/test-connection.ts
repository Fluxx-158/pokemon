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

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT VERSION() as version, NOW() as ts, DATABASE() as db'
    );
    const r = rows[0];
    console.log(`Connected: MySQL ${r.version} | db=${r.db} | ${r.ts}`);

    await conn.end();
}

main().catch((err) => {
    console.error('Connection failed:', err.message);
    process.exit(1);
});
