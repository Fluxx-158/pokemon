import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

interface SpotCheck {
    name: string;
    expectType?: string;
    expectClass?: string;
    expectPower?: number | null;
    expectAccuracy?: number | null;
    expectPpMainline?: number;
    expectPpPc?: number;
    expectPriority?: number;
    expectIsSlicing?: boolean;
    expectPcChanged?: boolean;
}

const SPOT_CHECKS: SpotCheck[] = [
    // PP overrides
    { name: 'protect',     expectType: 'normal',  expectClass: 'status',   expectPpMainline: 10, expectPpPc: 8,  expectPriority: 4, expectPcChanged: true },
    { name: 'earthquake',  expectType: 'ground',  expectClass: 'physical', expectPower: 100, expectAccuracy: 100, expectPpMainline: 10, expectPpPc: 12, expectPcChanged: true },
    // Slicing — PC additions
    { name: 'dragon-claw', expectType: 'dragon',  expectClass: 'physical', expectPower: 80,  expectAccuracy: 100, expectIsSlicing: true,  expectPcChanged: true },
    { name: 'shadow-claw', expectType: 'ghost',   expectClass: 'physical', expectPower: 70,  expectAccuracy: 100, expectIsSlicing: true,  expectPcChanged: true },
    // Slicing — mainline (NOT pc_changed)
    { name: 'slash',       expectType: 'normal',  expectClass: 'physical', expectPower: 70,  expectAccuracy: 100, expectIsSlicing: true,  expectPcChanged: false },
    { name: 'leaf-blade',  expectType: 'grass',   expectClass: 'physical', expectPower: 90,  expectIsSlicing: true,  expectPcChanged: false },
    { name: 'sacred-sword', expectType: 'fighting', expectClass: 'physical', expectPower: 90, expectIsSlicing: true, expectPcChanged: false },
    // Mundane checks
    { name: 'tackle',      expectType: 'normal',  expectClass: 'physical', expectIsSlicing: false, expectPcChanged: false },
    { name: 'fake-out',    expectType: 'normal',  expectClass: 'physical', expectPriority: 3,  expectIsSlicing: false, expectPcChanged: false },
    { name: 'hyper-beam',  expectType: 'normal',  expectClass: 'special',  expectPower: 150, expectAccuracy: 90 },
    { name: 'thunder-wave', expectType: 'electric', expectClass: 'status', expectAccuracy: 90 },
    // Dragon Claw / Shadow Claw not slicing on mainline — confirm pc_changed flag captures the difference
    { name: 'close-combat', expectType: 'fighting', expectClass: 'physical', expectPower: 120, expectIsSlicing: false },
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

    const [totalRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM moves');
    const [slicingRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM moves WHERE is_slicing = 1');
    const [pcChangedRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM moves WHERE pc_changed = 1');
    const [ppDivergentRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM moves WHERE pp_pc != pp_mainline');

    const total = totalRows[0].count;
    const slicing = slicingRows[0].count;
    const pcChanged = pcChangedRows[0].count;
    const ppDivergent = ppDivergentRows[0].count;

    console.log(`moves total:           ${total}  (expected 900+)`);
    console.log(`is_slicing=1:          ${slicing}  (expected 27 — 25 mainline + 2 PC additions)`);
    console.log(`pc_changed=1:          ${pcChanged}  (expected 4 — Protect, Earthquake, Dragon Claw, Shadow Claw)`);
    console.log(`pp_pc != pp_mainline:  ${ppDivergent}  (expected 2 — Protect, Earthquake)`);
    console.log('');

    let pass = 0;
    let fail = 0;

    console.log('Spot checks:');
    for (const check of SPOT_CHECKS) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(
            'SELECT name, type_name, damage_class, power, accuracy, pp_mainline, pp_pc, priority, is_slicing, pc_changed FROM moves WHERE name = ?',
            [check.name]
        );
        if (rows.length === 0) {
            console.log(`  [FAIL] ${check.name}: not found`);
            fail++;
            continue;
        }
        const r = rows[0];
        const issues: string[] = [];

        if (check.expectType && r.type_name !== check.expectType) {
            issues.push(`type=${r.type_name} (expected ${check.expectType})`);
        }
        if (check.expectClass && r.damage_class !== check.expectClass) {
            issues.push(`class=${r.damage_class} (expected ${check.expectClass})`);
        }
        if (check.expectPower !== undefined && r.power !== check.expectPower) {
            issues.push(`power=${r.power} (expected ${check.expectPower})`);
        }
        if (check.expectAccuracy !== undefined && r.accuracy !== check.expectAccuracy) {
            issues.push(`accuracy=${r.accuracy} (expected ${check.expectAccuracy})`);
        }
        if (check.expectPpMainline !== undefined && r.pp_mainline !== check.expectPpMainline) {
            issues.push(`pp_mainline=${r.pp_mainline} (expected ${check.expectPpMainline})`);
        }
        if (check.expectPpPc !== undefined && r.pp_pc !== check.expectPpPc) {
            issues.push(`pp_pc=${r.pp_pc} (expected ${check.expectPpPc})`);
        }
        if (check.expectPriority !== undefined && r.priority !== check.expectPriority) {
            issues.push(`priority=${r.priority} (expected ${check.expectPriority})`);
        }
        if (check.expectIsSlicing !== undefined) {
            const actual = Boolean(r.is_slicing);
            if (actual !== check.expectIsSlicing) {
                issues.push(`is_slicing=${actual} (expected ${check.expectIsSlicing})`);
            }
        }
        if (check.expectPcChanged !== undefined) {
            const actual = Boolean(r.pc_changed);
            if (actual !== check.expectPcChanged) {
                issues.push(`pc_changed=${actual} (expected ${check.expectPcChanged})`);
            }
        }

        if (issues.length === 0) {
            console.log(`  [OK  ] ${check.name}`);
            pass++;
        } else {
            console.log(`  [FAIL] ${check.name}: ${issues.join('; ')}`);
            fail++;
        }
    }

    console.log(`\n${pass} passed, ${fail} failed`);

    await conn.end();
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
