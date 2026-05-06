import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, inArray, sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { MovesTable } from '../src/db/schema/moves';
import { touchMetadata } from '../src/db/metadata-write';

interface PpOverride {
    name: string;
    ppPc: number;
    pcNotes: string;
}

// PC PP/behavior overrides vs mainline.
const PP_OVERRIDES: PpOverride[] = [
    {
        name: 'protect',
        ppPc: 8,
        pcNotes: 'Reduced from 16 PP in mainline to 8 PP in PC. Significant for Protect-stack teams; can be PP-stalled in long matches.',
    },
    {
        name: 'earthquake',
        ppPc: 12,
        pcNotes: 'Reduced from 16 PP in mainline to 12 PP in PC.',
    },
];

// Mainline slicing moves (boosted by Sharpness, pierce Substitute).
// Source: Bulbapedia "slicing-pierce" / Sharpness category as of late 2024.
// Maintain manually — PokeAPI does not expose this flag.
const MAINLINE_SLICING: string[] = [
    'air-cutter',
    'air-slash',
    'aqua-cutter',
    'behemoth-bash',
    'behemoth-blade',
    'bitter-blade',
    'ceaseless-edge',
    'cross-poison',
    'cut',
    'fury-cutter',
    'kowtow-cleave',
    'leaf-blade',
    'mighty-cleave',
    'night-slash',
    'population-bomb',
    'psyblade',
    'psycho-cut',
    'razor-leaf',
    'razor-shell',
    'sacred-sword',
    'secret-sword',
    'slash',
    'solar-blade',
    'stone-axe',
    'x-scissor',
];

// PC additions to slicing — flagged pc_changed=1.
interface PcSlicingAddition {
    name: string;
    pcNotes: string;
}
const PC_SLICING_ADDITIONS: PcSlicingAddition[] = [
    {
        name: 'dragon-claw',
        pcNotes: 'Added to slicing category in PC (boosted by Sharpness; pierces Substitute). Mainline: not slicing.',
    },
    {
        name: 'shadow-claw',
        pcNotes: 'Added to slicing category in PC (boosted by Sharpness; pierces Substitute). Mainline: not slicing.',
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
    const db = drizzle(conn, { mode: 'default' });

    // Reset to mainline state so removed entries clear correctly on re-run.
    await db.execute(sql`UPDATE moves SET pp_pc = pp_mainline, is_slicing = 0, pc_changed = 0, pc_notes = NULL`);

    let ppApplied = 0;
    let slicingApplied = 0;
    let pcSlicingApplied = 0;
    const missing: string[] = [];

    // PP overrides: pp_pc + pc_changed + pc_notes.
    for (const o of PP_OVERRIDES) {
        const result = await db
            .update(MovesTable)
            .set({ ppPc: o.ppPc, pcChanged: 1, pcNotes: o.pcNotes })
            .where(eq(MovesTable.name, o.name));
        const affected = (result as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;
        if (affected === 0) missing.push(`pp:${o.name}`);
        else ppApplied++;
    }

    // Mainline slicing: is_slicing=1 only.
    const slicingResult = await db
        .update(MovesTable)
        .set({ isSlicing: 1 })
        .where(inArray(MovesTable.name, MAINLINE_SLICING));
    slicingApplied = (slicingResult as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;
    if (slicingApplied < MAINLINE_SLICING.length) {
        // Find which ones were missing.
        const found = await db
            .select({ name: MovesTable.name })
            .from(MovesTable)
            .where(inArray(MovesTable.name, MAINLINE_SLICING));
        const foundSet = new Set(found.map((r) => r.name));
        for (const name of MAINLINE_SLICING) {
            if (!foundSet.has(name)) missing.push(`slicing:${name}`);
        }
    }

    // PC slicing additions: is_slicing + pc_changed + pc_notes.
    for (const o of PC_SLICING_ADDITIONS) {
        const result = await db
            .update(MovesTable)
            .set({ isSlicing: 1, pcChanged: 1, pcNotes: o.pcNotes })
            .where(eq(MovesTable.name, o.name));
        const affected = (result as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;
        if (affected === 0) missing.push(`pc-slicing:${o.name}`);
        else pcSlicingApplied++;
    }

    console.log(`PP overrides applied:        ${ppApplied}/${PP_OVERRIDES.length}`);
    console.log(`Mainline slicing applied:    ${slicingApplied}/${MAINLINE_SLICING.length}`);
    console.log(`PC slicing additions:        ${pcSlicingApplied}/${PC_SLICING_ADDITIONS.length}`);

    if (missing.length) {
        console.warn(`\nWARNING: not found in DB (skipped):`);
        for (const m of missing) console.warn(`  - ${m}`);
        console.warn('Did you run `npm run sync:moves` first? If a move was renamed in PokeAPI, update this overlay.');
    }

    await touchMetadata(db, 'last_pc_overlay_sync');
    await conn.end();
    if (missing.length) process.exit(1);
}

main().catch((err) => {
    console.error('PC overlay failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
