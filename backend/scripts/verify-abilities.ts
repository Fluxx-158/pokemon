import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

interface SpotCheck {
    name: string;
    expectGeneration?: number;
    expectPcChanged?: boolean;
    expectShortEffectIncludes?: string;
}

const SPOT_CHECKS: SpotCheck[] = [
    { name: 'intimidate',         expectGeneration: 3, expectPcChanged: false, expectShortEffectIncludes: 'attack' },
    { name: 'protean',            expectGeneration: 6, expectPcChanged: true },
    { name: 'unseen-fist',        expectGeneration: 8, expectPcChanged: true },
    { name: 'unnerve',            expectGeneration: 5, expectPcChanged: true },
    { name: 'defiant',            expectGeneration: 5, expectPcChanged: false },
    { name: 'competitive',        expectGeneration: 6, expectPcChanged: false },
    { name: 'sharpness',          expectGeneration: 9, expectPcChanged: false },
    { name: 'snow-warning',       expectGeneration: 4, expectPcChanged: false },
    { name: 'prankster',          expectGeneration: 5, expectPcChanged: false },
    { name: 'levitate',           expectGeneration: 3, expectPcChanged: false },
];

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });

    const [countRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM abilities');
    const [pcCountRows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) AS count FROM abilities WHERE pc_changed = 1'
    );

    const total = countRows[0].count;
    const pcChanged = pcCountRows[0].count;

    console.log(`abilities total:       ${total}  (expected 300+)`);
    console.log(`abilities pc_changed:  ${pcChanged}  (expected 3 — Unnerve, Unseen Fist, Protean)`);
    console.log('');

    let pass = 0;
    let fail = 0;

    console.log('Spot checks:');
    for (const check of SPOT_CHECKS) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(
            'SELECT name, display_name, generation, pc_changed, short_effect FROM abilities WHERE name = ?',
            [check.name]
        );
        if (rows.length === 0) {
            console.log(`  [FAIL] ${check.name}: not found`);
            fail++;
            continue;
        }
        const row = rows[0];
        const issues: string[] = [];
        if (check.expectGeneration !== undefined && row.generation !== check.expectGeneration) {
            issues.push(`gen=${row.generation} (expected ${check.expectGeneration})`);
        }
        if (check.expectPcChanged !== undefined) {
            const actual = Boolean(row.pc_changed);
            if (actual !== check.expectPcChanged) {
                issues.push(`pc_changed=${actual} (expected ${check.expectPcChanged})`);
            }
        }
        if (check.expectShortEffectIncludes && !String(row.short_effect ?? '').toLowerCase().includes(check.expectShortEffectIncludes.toLowerCase())) {
            issues.push(`short_effect missing "${check.expectShortEffectIncludes}"`);
        }
        if (issues.length === 0) {
            console.log(`  [OK  ] ${check.name} (${row.display_name}, gen ${row.generation}, pc_changed=${Boolean(row.pc_changed)})`);
            pass++;
        } else {
            console.log(`  [FAIL] ${check.name}: ${issues.join('; ')}`);
            fail++;
        }
    }

    console.log(`\n${pass} passed, ${fail} failed`);

    await conn.end();
    if (fail > 0 || pcChanged !== 3) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
