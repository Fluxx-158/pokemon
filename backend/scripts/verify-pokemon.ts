import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

interface SpotCheck {
    name: string;
    expectGen?: number;
    expectIsMega?: boolean;
    expectIsRegional?: boolean;
    expectRegionVariant?: string | null;
    expectType1?: string;
    expectType2?: string | null;
    expectBst?: number; // base stat total
    expectBaseSpe?: number;
    expectAbilities?: string[]; // unordered
    expectMoves?: string[]; // any-of subset must be present
    expectMissingMoves?: string[]; // moves that should NOT be in learnset
}

const SPOT_CHECKS: SpotCheck[] = [
    // Base species
    {
        name: 'charizard',
        expectGen: 1,
        expectIsMega: false,
        expectType1: 'fire',
        expectType2: 'flying',
        expectBst: 534,
        expectBaseSpe: 100,
        expectAbilities: ['blaze', 'solar-power'],
        expectMoves: ['flamethrower', 'air-slash'],
    },
    // Mega
    {
        name: 'charizard-mega-x',
        expectIsMega: true,
        expectType1: 'fire',
        expectType2: 'dragon',
        expectBst: 634,
    },
    {
        name: 'charizard-mega-y',
        expectIsMega: true,
        expectType1: 'fire',
        expectType2: 'flying',
        expectBst: 634,
    },
    // Regional variants
    {
        name: 'raichu-alola',
        expectIsRegional: true,
        expectRegionVariant: 'alola',
        expectType1: 'electric',
        expectType2: 'psychic',
    },
    {
        name: 'zoroark-hisui',
        expectIsRegional: true,
        expectRegionVariant: 'hisui',
        expectType1: 'normal',
        expectType2: 'ghost',
    },
    {
        name: 'tauros-paldea-blaze-breed',
        expectIsRegional: true,
        expectRegionVariant: 'paldea',
        expectType1: 'fighting',
        expectType2: 'fire',
    },
    // PC-relevant: Incineroar can NOT learn Knock Off
    {
        name: 'incineroar',
        expectType1: 'fire',
        expectType2: 'dark',
        expectMoves: ['throat-chop'],
        expectMissingMoves: ['knock-off'], // expect pc_available=0 if present
    },
    // PC-relevant: Gengar can NOT learn Encore
    {
        name: 'gengar',
        expectType1: 'ghost',
        expectType2: 'poison',
        expectMissingMoves: ['encore'],
    },
    // Meta threat
    {
        name: 'kingambit',
        expectType1: 'dark',
        expectType2: 'steel',
        expectAbilities: ['defiant', 'supreme-overlord', 'pressure'],
    },
    // Battle-form alternates
    {
        name: 'urshifu-rapid-strike',
        expectType1: 'fighting',
        expectType2: 'water',
    },
    {
        name: 'tornadus-therian',
        expectType1: 'flying',
    },
    // Floette-Eternal — doubles meta mega target.
    {
        name: 'floette-eternal',
        expectType1: 'fairy',
    },
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

    const [totalRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon');
    const [defaultRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon WHERE is_default = 1');
    const [megaRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon WHERE is_mega = 1');
    const [regionRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon WHERE is_regional = 1');
    const [paRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon_abilities');
    const [pmRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon_moves');
    const [pmUnavailRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS count FROM pokemon_moves WHERE pc_available = 0');

    console.log(`pokemon total:           ${totalRows[0].count}  (expected 1300+)`);
    console.log(`  is_default=1:          ${defaultRows[0].count}  (expected ~1025)`);
    console.log(`  is_mega=1:             ${megaRows[0].count}  (expected 40+)`);
    console.log(`  is_regional=1:         ${regionRows[0].count}  (expected 40+)`);
    console.log(`pokemon_abilities:       ${paRows[0].count}  (expected 2500+)`);
    console.log(`pokemon_moves:           ${pmRows[0].count}  (expected 60000+)`);
    console.log(`  pc_available=0:        ${pmUnavailRows[0].count}  (expected 2: incineroar/knock-off + gengar/encore)`);
    console.log('');

    let pass = 0;
    let fail = 0;

    console.log('Spot checks:');
    for (const check of SPOT_CHECKS) {
        const [rows] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT p.id, p.name, p.is_mega, p.is_regional, p.region_variant, p.bst, p.base_spe, p.generation,
                    t1.name AS type1, t2.name AS type2
             FROM pokemon p
             JOIN types t1 ON t1.id = p.type1_id
             LEFT JOIN types t2 ON t2.id = p.type2_id
             WHERE p.name = ?`,
            [check.name],
        );
        if (rows.length === 0) {
            console.log(`  [FAIL] ${check.name}: not found`);
            fail++;
            continue;
        }
        const r = rows[0];
        const issues: string[] = [];

        if (check.expectGen !== undefined && r.generation !== check.expectGen) {
            issues.push(`generation=${r.generation} (expected ${check.expectGen})`);
        }
        if (check.expectIsMega !== undefined && Boolean(r.is_mega) !== check.expectIsMega) {
            issues.push(`is_mega=${Boolean(r.is_mega)} (expected ${check.expectIsMega})`);
        }
        if (check.expectIsRegional !== undefined && Boolean(r.is_regional) !== check.expectIsRegional) {
            issues.push(`is_regional=${Boolean(r.is_regional)} (expected ${check.expectIsRegional})`);
        }
        if (check.expectRegionVariant !== undefined && r.region_variant !== check.expectRegionVariant) {
            issues.push(`region_variant=${r.region_variant} (expected ${check.expectRegionVariant})`);
        }
        if (check.expectType1 !== undefined && (r.type1 ?? '').toLowerCase() !== check.expectType1.toLowerCase()) {
            issues.push(`type1=${r.type1} (expected ${check.expectType1})`);
        }
        if (check.expectType2 !== undefined) {
            const got = (r.type2 ?? null) as string | null;
            const want = check.expectType2;
            const equal = (got === null && want === null) || (got !== null && want !== null && got.toLowerCase() === want.toLowerCase());
            if (!equal) issues.push(`type2=${got} (expected ${want})`);
        }
        if (check.expectBst !== undefined && r.bst !== check.expectBst) {
            issues.push(`bst=${r.bst} (expected ${check.expectBst})`);
        }
        if (check.expectBaseSpe !== undefined && r.base_spe !== check.expectBaseSpe) {
            issues.push(`base_spe=${r.base_spe} (expected ${check.expectBaseSpe})`);
        }

        if (check.expectAbilities) {
            const [aRows] = await conn.query<mysql.RowDataPacket[]>(
                `SELECT a.name FROM pokemon_abilities pa JOIN abilities a ON a.id = pa.ability_id WHERE pa.pokemon_id = ?`,
                [r.id],
            );
            const got = new Set(aRows.map((x) => x.name as string));
            const missing = check.expectAbilities.filter((n) => !got.has(n));
            if (missing.length) issues.push(`missing abilities: ${missing.join(', ')}`);
        }

        if (check.expectMoves) {
            const [mRows] = await conn.query<mysql.RowDataPacket[]>(
                `SELECT m.name FROM pokemon_moves pm JOIN moves m ON m.id = pm.move_id WHERE pm.pokemon_id = ? AND pm.pc_available = 1`,
                [r.id],
            );
            const got = new Set(mRows.map((x) => x.name as string));
            const missing = check.expectMoves.filter((n) => !got.has(n));
            if (missing.length) issues.push(`missing moves: ${missing.join(', ')}`);
        }

        if (check.expectMissingMoves) {
            for (const moveName of check.expectMissingMoves) {
                const [mRows] = await conn.query<mysql.RowDataPacket[]>(
                    `SELECT pm.pc_available FROM pokemon_moves pm JOIN moves m ON m.id = pm.move_id WHERE pm.pokemon_id = ? AND m.name = ?`,
                    [r.id, moveName],
                );
                if (mRows.length === 0) continue; // not in learnset at all = good
                if (mRows[0].pc_available !== 0) {
                    issues.push(`expected ${moveName} to be pc_available=0 (got ${mRows[0].pc_available})`);
                }
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
