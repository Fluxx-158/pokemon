import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
    });

    console.log(`Connected to MySQL at ${config.host}:${config.port} as ${config.user}`);

    const [versionRows] = await conn.query<mysql.RowDataPacket[]>('SELECT VERSION() as version');
    console.log(`MySQL version: ${versionRows[0].version}`);

    await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.database}\` ` +
        `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Database \`${config.database}\` is ready`);

    await conn.end();
}

main().catch((err) => {
    console.error('Setup failed:', err.message);
    process.exit(1);
});
