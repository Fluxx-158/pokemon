import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { AbilitiesTable } from '../src/db/schema/abilities';
import { touchMetadata } from '../src/db/metadata-write';

interface PcOverlay {
    name: string;
    pcNotes: string;
}

// PC ability deltas vs mainline. Update here when new ability changes
// land in a PC patch.
const OVERLAYS: PcOverlay[] = [
    {
        name: 'unnerve',
        pcNotes:
            'Bug fixed in PC: now reliably blocks the target from eating berries (mainline behavior was unreliable).',
    },
    {
        name: 'unseen-fist',
        pcNotes:
            'Nerfed in PC: contact moves deal only 1/4 damage through Protect (mainline: full damage through Protect).',
    },
    {
        name: 'protean',
        pcNotes:
            'Triggers ONCE per switch-in (Gen 9 mainline behavior — worth noting since older-format players may expect per-move triggering). The first move locks the type for the rest of the appearance. Status moves like Protect burn the activation, committing the user to Normal-type for that appearance.',
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

    // Reset all overlays first so removed entries clear correctly.
    await db.update(AbilitiesTable).set({ pcChanged: 0, pcNotes: null });

    let applied = 0;
    let missing: string[] = [];
    for (const o of OVERLAYS) {
        const result = await db
            .update(AbilitiesTable)
            .set({ pcChanged: 1, pcNotes: o.pcNotes })
            .where(eq(AbilitiesTable.name, o.name));
        const affected = (result as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;
        if (affected === 0) {
            missing.push(o.name);
        } else {
            applied++;
        }
    }

    console.log(`Applied PC overlay to ${applied}/${OVERLAYS.length} abilities`);
    if (missing.length) {
        console.warn(`WARNING: not found in DB (skipped): ${missing.join(', ')}`);
        console.warn('Did you run `npm run sync:abilities` first?');
    }

    await touchMetadata(db, 'last_pc_overlay_sync');
    await conn.end();
    if (missing.length) process.exit(1);
}

main().catch((err) => {
    console.error('PC overlay failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
