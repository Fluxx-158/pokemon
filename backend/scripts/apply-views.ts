import * as fs from 'node:fs';
import * as path from 'node:path';
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
        multipleStatements: true,
    });

    const viewsDir = path.join(__dirname, 'views');
    const files = fs.readdirSync(viewsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
        const sql = fs.readFileSync(path.join(viewsDir, file), 'utf8');
        console.log(`Applying view: ${file}`);
        await conn.query(sql);
    }

    console.log(`Applied ${files.length} view(s)`);
    await conn.end();
}

main().catch((err) => {
    console.error('Failed to apply views:', err.message);
    process.exit(1);
});
