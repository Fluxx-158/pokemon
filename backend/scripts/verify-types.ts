import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

interface Check {
    label: string;
    sql: string;
    expected: number;
}

const SINGLE_TYPE_CHECKS: Check[] = [
    { label: 'Fire -> Grass',         sql: singleQ('Fire', 'Grass'),         expected: 2 },
    { label: 'Fire -> Water',         sql: singleQ('Fire', 'Water'),         expected: 0.5 },
    { label: 'Electric -> Ground',    sql: singleQ('Electric', 'Ground'),    expected: 0 },
    { label: 'Normal -> Ghost',       sql: singleQ('Normal', 'Ghost'),       expected: 0 },
    { label: 'Fighting -> Fairy',     sql: singleQ('Fighting', 'Fairy'),     expected: 0.5 },
    { label: 'Dragon -> Fairy',       sql: singleQ('Dragon', 'Fairy'),       expected: 0 },
    { label: 'Steel -> Fairy',        sql: singleQ('Steel', 'Fairy'),        expected: 2 },
];

const DUAL_TYPE_CHECKS: Check[] = [
    { label: 'Rock -> Fire/Flying (Charizard 4x)',  sql: dualQ('Rock', 'Fire', 'Flying'),     expected: 4 },     // 2 * 2 (super-effective vs both)
    { label: 'Ground -> Fire/Flying (dual, immune)', sql: dualQ('Ground', 'Fire', 'Flying'),   expected: 0 },     // 2 * 0
    { label: 'Ice -> Dragon/Flying (dual, 4x)',     sql: dualQ('Ice', 'Dragon', 'Flying'),    expected: 4 },     // 2 * 2
    { label: 'Fire -> Grass/Steel (dual, 4x)',      sql: dualQ('Fire', 'Grass', 'Steel'),     expected: 4 },     // 2 * 2
    { label: 'Fire -> Steel/Steel (mono via view)', sql: dualQ('Fire', 'Steel', 'Steel'),     expected: 2 },     // mono case
    { label: 'Normal -> Ghost/Ghost (mono immune)', sql: dualQ('Normal', 'Ghost', 'Ghost'),   expected: 0 },
    { label: 'Rock -> Flying/Fire (ordering symmetry)', sql: dualQ('Rock', 'Flying', 'Fire'), expected: 4 },     // same as Fire/Flying
];

function singleQ(attacker: string, defender: string): string {
    return `
        SELECT tc.multiplier
        FROM type_chart tc
        JOIN types a ON a.id = tc.attacker_type_id
        JOIN types d ON d.id = tc.defender_type_id
        WHERE a.name = '${attacker}' AND d.name = '${defender}'
    `;
}

function dualQ(attacker: string, type1: string, type2: string): string {
    return `
        SELECT dte.multiplier
        FROM dual_type_effectiveness dte
        JOIN types a ON a.id = dte.attacker_type_id
        JOIN types t1 ON t1.id = dte.defender_type1_id
        JOIN types t2 ON t2.id = dte.defender_type2_id
        WHERE a.name = '${attacker}' AND t1.name = '${type1}' AND t2.name = '${type2}'
    `;
}

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });

    const [typesCount] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM types');
    const [chartCount] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM type_chart');
    const [viewCount]  = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM dual_type_effectiveness');

    console.log(`types:                   ${typesCount[0].count}  (expected 18)`);
    console.log(`type_chart:              ${chartCount[0].count}  (expected 324)`);
    console.log(`dual_type_effectiveness: ${viewCount[0].count}  (expected 5832)`);
    console.log('');

    let pass = 0;
    let fail = 0;

    console.log('Single-type checks:');
    for (const c of SINGLE_TYPE_CHECKS) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(c.sql);
        const actual = rows.length ? Number(rows[0].multiplier) : null;
        const ok = actual === c.expected;
        if (ok) pass++; else fail++;
        console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${c.label}: ${actual}${ok ? '' : ` (expected ${c.expected})`}`);
    }

    console.log('\nDual-type checks (via view):');
    for (const c of DUAL_TYPE_CHECKS) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(c.sql);
        const actual = rows.length ? Number(rows[0].multiplier) : null;
        const ok = actual === c.expected;
        if (ok) pass++; else fail++;
        console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${c.label}: ${actual}${ok ? '' : ` (expected ${c.expected})`}`);
    }

    console.log(`\n${pass} passed, ${fail} failed`);

    await conn.end();
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err.message);
    process.exit(1);
});
