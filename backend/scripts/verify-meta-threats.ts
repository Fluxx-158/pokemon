import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

// Sanity check: every entry in frontend/src/data/meta-threats.json must
// reference a pokemon that exists in the DB by display_name. Catches typos
// before the speed-tier UI silently drops entries.
const META_THREATS_PATH = join(__dirname, '..', '..', 'frontend', 'src', 'data', 'meta-threats.json');

interface Entry {
    pokemonName: string;
    notes?: string;
}

function lc(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
    const raw = readFileSync(META_THREATS_PATH, 'utf8');
    const entries = JSON.parse(raw) as Entry[];

    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT id, display_name, base_spe FROM pokemon',
    );
    const exact = new Map<string, { id: number; spe: number }>();
    const fuzzy = new Map<string, string>();
    for (const r of rows) {
        const name = r.display_name as string;
        exact.set(name, { id: r.id as number, spe: r.base_spe as number });
        fuzzy.set(lc(name), name);
    }

    console.log(`Verifying ${entries.length} meta-threat entries against ${rows.length} pokemon`);
    let pass = 0;
    let fail = 0;
    for (const e of entries) {
        const hit = exact.get(e.pokemonName);
        if (hit) {
            console.log(`  [OK]   ${e.pokemonName.padEnd(28)} base Spe ${hit.spe}`);
            pass++;
        } else {
            const suggest = fuzzy.get(lc(e.pokemonName));
            if (suggest) {
                console.log(`  [FAIL] ${e.pokemonName}: not found exactly; did you mean "${suggest}"?`);
            } else {
                console.log(`  [FAIL] ${e.pokemonName}: not found`);
            }
            fail++;
        }
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    await conn.end();
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Verify meta-threats failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
