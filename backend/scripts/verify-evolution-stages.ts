import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

interface StageCheck {
    name: string;
    expectStage: string;
}

const SPOT_CHECKS: StageCheck[] = [
    // Three-stage line (no baby): Charmander → Charmeleon → Charizard.
    { name: 'charmander', expectStage: 'basic' },
    { name: 'charmeleon', expectStage: 'stage1' },
    { name: 'charizard', expectStage: 'stage2' },
    // Mega override (carries Charizard's species id but must read 'mega').
    { name: 'charizard-mega-x', expectStage: 'mega' },
    // Baby-shifted line: Pichu → Pikachu → Raichu.
    { name: 'pichu', expectStage: 'baby' },
    { name: 'pikachu', expectStage: 'basic' },
    { name: 'raichu', expectStage: 'stage1' },
    // Regional form inherits base species stage (Raichu = stage1).
    { name: 'raichu-alola', expectStage: 'stage1' },
    // Non-evolving species default to basic.
    { name: 'ditto', expectStage: 'basic' },
    { name: 'tauros', expectStage: 'basic' },
    // Two-stage line: Gastly → Haunter → Gengar.
    { name: 'gengar', expectStage: 'stage2' },
    // PC meta single-stage / pseudo lines.
    { name: 'garchomp', expectStage: 'stage2' },
    { name: 'kingambit', expectStage: 'stage2' },
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

    const [stageRows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT stage, COUNT(*) AS count FROM pokemon GROUP BY stage ORDER BY stage',
    );
    console.log('Stage distribution:');
    for (const r of stageRows) console.log(`  ${String(r.stage).padEnd(7)} ${r.count}`);

    const [megaMismatch] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM pokemon WHERE is_mega = 1 AND stage <> 'mega'",
    );
    console.log(`\nMega rows not tagged 'mega': ${megaMismatch[0].count} (expected 0)`);
    const [nonMegaStage] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM pokemon WHERE is_mega = 0 AND stage = 'mega'",
    );
    console.log(`Non-mega rows tagged 'mega': ${nonMegaStage[0].count} (expected 0)`);
    console.log('');

    let pass = 0;
    let fail = 0;
    console.log('Spot checks:');
    for (const check of SPOT_CHECKS) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(
            'SELECT stage FROM pokemon WHERE name = ?',
            [check.name],
        );
        if (rows.length === 0) {
            console.log(`  [FAIL] ${check.name}: not found`);
            fail++;
            continue;
        }
        if (rows[0].stage === check.expectStage) {
            console.log(`  [OK  ] ${check.name} = ${rows[0].stage}`);
            pass++;
        } else {
            console.log(`  [FAIL] ${check.name}: stage=${rows[0].stage} (expected ${check.expectStage})`);
            fail++;
        }
    }

    const failMega = Number(megaMismatch[0].count) > 0 || Number(nonMegaStage[0].count) > 0;
    console.log(`\n${pass} passed, ${fail} failed`);

    await conn.end();
    if (fail > 0 || failMega) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
