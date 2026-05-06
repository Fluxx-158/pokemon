import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, sql, and, inArray, notInArray } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { ItemsTable } from '../src/db/schema/items';
import { touchMetadata } from '../src/db/metadata-write';

interface PcOnlyItem {
    id: number;
    name: string;
    displayName: string;
    category: string;
    flingPower: number | null;
    shortEffect: string;
    effect: string;
}

interface SpecificNote {
    name: string;
    pcNotes: string;
}

// =============================================================================
// PC HELD ITEM WHITELIST — source of truth: Champions Database "Held Items" sheet.
// Any item with is_holdable=1 NOT in this set is flagged pc_available=0.
// Update this list when the sheet changes.
// =============================================================================
const PC_HELD_ITEM_SLUGS = new Set<string>([
    // Mega Stone (59)
    'manectite', 'houndoominite', 'audinite', 'lopunnite', 'sablenite',
    'sharpedonite', 'gyaradosite', 'lucarionite', 'heracronite', 'aerodactylite',
    'glalitite', 'pinsirite', 'gardevoirite', 'galladite', 'skarmorite',
    'clefablite', 'alakazite', 'drampanite', 'excadrite', 'chandelurite',
    'aggronite', 'gengarite', 'medichamite', 'abomasite', 'scizorite',
    'garchompite', 'steelixite', 'kangaskhanite', 'charizardite-x', 'charizardite-y',
    'blastoisinite', 'meganiumite', 'feraligite', 'emboarite', 'beedrillite',
    'ampharosite', 'victreebelite', 'banettite', 'cameruptite', 'absolite',
    'slowbronite', 'hawluchanite', 'altarianite', 'dragoninite', 'froslassite',
    'pidgeotite', 'starminite', 'tyranitarite', 'venusaurite', 'floettite',
    'greninjite', 'delphoxite', 'chesnaughtite', 'chimechite', 'crabominite',
    'glimmoranite', 'golurkite', 'meowsticite', 'scovillainite',
    // Defense - resist berries (18)
    'roseli-berry', 'chilan-berry', 'babiri-berry', 'haban-berry', 'charti-berry',
    'tanga-berry', 'payapa-berry', 'kebia-berry', 'chople-berry', 'rindo-berry',
    'occa-berry', 'wacan-berry', 'colbur-berry', 'kasib-berry', 'coba-berry',
    'shuca-berry', 'yache-berry', 'passho-berry',
    // Power Boost - +20% type-boosting items (18)
    'spell-tag', 'metal-coat', 'soft-sand', 'sharp-beak', 'silk-scarf',
    'magnet', 'black-belt', 'black-glasses', 'silver-powder', 'miracle-seed',
    'hard-stone', 'mystic-water', 'poison-barb', 'never-melt-ice', 'twisted-spoon',
    'charcoal', 'dragon-fang', 'fairy-feather',
    // Recovery (14)
    'sitrus-berry', 'lum-berry', 'persim-berry', 'oran-berry', 'leppa-berry',
    'aspear-berry', 'rawst-berry', 'pecha-berry', 'chesto-berry', 'cheri-berry',
    'focus-band', 'mental-herb', 'leftovers', 'shell-bell',
    // Stat Boost (3)
    'white-herb', 'choice-scarf', 'focus-sash',
    // Other (5)
    'kings-rock', 'bright-powder', 'scope-lens', 'quick-claw', 'light-ball',
]);

// =============================================================================
// PC-ONLY ITEMS — items present in PC but not in PokeAPI.
// Synthetic IDs start at 100001 to avoid collision with PokeAPI's id space.
// =============================================================================
const PC_ITEM_ADDITIONS: PcOnlyItem[] = [
    { id: 100001, name: 'skarmorite',     displayName: 'Skarmorite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Skarmory to Mega Evolve.',     effect: 'A held item that allows Skarmory to Mega Evolve.' },
    { id: 100002, name: 'clefablite',     displayName: 'Clefablite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Clefable to Mega Evolve.',     effect: 'A held item that allows Clefable to Mega Evolve.' },
    { id: 100003, name: 'drampanite',     displayName: 'Drampanite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Drampa to Mega Evolve.',       effect: 'A held item that allows Drampa to Mega Evolve.' },
    { id: 100004, name: 'excadrite',      displayName: 'Excadrite',      category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Excadrill to Mega Evolve.',    effect: 'A held item that allows Excadrill to Mega Evolve.' },
    { id: 100005, name: 'chandelurite',   displayName: 'Chandelurite',   category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Chandelure to Mega Evolve.',   effect: 'A held item that allows Chandelure to Mega Evolve.' },
    { id: 100006, name: 'meganiumite',    displayName: 'Meganiumite',    category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Meganium to Mega Evolve.',     effect: 'A held item that allows Meganium to Mega Evolve.' },
    { id: 100007, name: 'feraligite',     displayName: 'Feraligite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Feraligatr to Mega Evolve.',   effect: 'A held item that allows Feraligatr to Mega Evolve.' },
    { id: 100008, name: 'emboarite',      displayName: 'Emboarite',      category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Emboar to Mega Evolve.',       effect: 'A held item that allows Emboar to Mega Evolve.' },
    { id: 100009, name: 'victreebelite',  displayName: 'Victreebelite',  category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Victreebel to Mega Evolve.',   effect: 'A held item that allows Victreebel to Mega Evolve.' },
    { id: 100010, name: 'hawluchanite',   displayName: 'Hawluchanite',   category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Hawlucha to Mega Evolve.',     effect: 'A held item that allows Hawlucha to Mega Evolve.' },
    { id: 100011, name: 'dragoninite',    displayName: 'Dragoninite',    category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Dragonite to Mega Evolve.',    effect: 'A held item that allows Dragonite to Mega Evolve.' },
    { id: 100012, name: 'froslassite',    displayName: 'Froslassite',    category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Froslass to Mega Evolve.',     effect: 'A held item that allows Froslass to Mega Evolve.' },
    { id: 100013, name: 'starminite',     displayName: 'Starminite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Starmie to Mega Evolve.',      effect: 'A held item that allows Starmie to Mega Evolve.' },
    { id: 100014, name: 'floettite',      displayName: 'Floettite',      category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Floette to Mega Evolve.',      effect: 'A held item that allows Floette to Mega Evolve.' },
    { id: 100015, name: 'greninjite',     displayName: 'Greninjite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Greninja to Mega Evolve.',     effect: 'A held item that allows Greninja to Mega Evolve.' },
    { id: 100016, name: 'delphoxite',     displayName: 'Delphoxite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Delphox to Mega Evolve.',      effect: 'A held item that allows Delphox to Mega Evolve.' },
    { id: 100017, name: 'chesnaughtite',  displayName: 'Chesnaughtite',  category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Chesnaught to Mega Evolve.',   effect: 'A held item that allows Chesnaught to Mega Evolve.' },
    { id: 100018, name: 'chimechite',     displayName: 'Chimechite',     category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Chimecho to Mega Evolve.',     effect: 'A held item that allows Chimecho to Mega Evolve.' },
    { id: 100019, name: 'crabominite',    displayName: 'Crabominite',    category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Crabominable to Mega Evolve.', effect: 'A held item that allows Crabominable to Mega Evolve.' },
    { id: 100020, name: 'glimmoranite',   displayName: 'Glimmoranite',   category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Glimmora to Mega Evolve.',     effect: 'A held item that allows Glimmora to Mega Evolve.' },
    { id: 100021, name: 'golurkite',      displayName: 'Golurkite',      category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Golurk to Mega Evolve.',       effect: 'A held item that allows Golurk to Mega Evolve.' },
    { id: 100022, name: 'meowsticite',    displayName: 'Meowsticite',    category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Meowstic to Mega Evolve.',     effect: 'A held item that allows Meowstic to Mega Evolve.' },
    { id: 100023, name: 'scovillainite',  displayName: 'Scovillainite',  category: 'mega-stones', flingPower: 80, shortEffect: 'Allows Scovillain to Mega Evolve.',   effect: 'A held item that allows Scovillain to Mega Evolve.' },
];

// =============================================================================
// SPECIFIC PC NOTES — detailed notes for high-impact banned items, layered on
// top of the generic "not in sheet" message after the bulk audit.
// =============================================================================
const SPECIFIC_NOTES: SpecificNote[] = [
    // PC trimmed item pool — items present in mainline but not legal in PC.
    { name: 'life-orb',         pcNotes: 'Not in PC. The +20% type-boost items (Charcoal, Mystic Water, etc.) are the strongest offensive items in PC.' },
    { name: 'choice-band',      pcNotes: 'Not in PC. Choice Scarf is the only Choice item available.' },
    { name: 'choice-specs',     pcNotes: 'Not in PC. Choice Scarf is the only Choice item available.' },
    { name: 'assault-vest',     pcNotes: 'Not in PC.' },
    { name: 'eviolite',         pcNotes: 'Not in PC.' },
    { name: 'weakness-policy',  pcNotes: 'Not in PC.' },
    { name: 'rocky-helmet',     pcNotes: 'Not in PC.' },
    { name: 'safety-goggles',   pcNotes: 'Not in PC. Plan around weather chip and powder moves without it.' },
    { name: 'heavy-duty-boots', pcNotes: 'Not in PC. Stealth Rock chip is unavoidable on switch-in.' },
    { name: 'throat-spray',     pcNotes: 'Not in PC.' },
    { name: 'mirror-herb',      pcNotes: 'Not in PC.' },
    { name: 'clear-amulet',     pcNotes: 'Not in PC. Defiant / Competitive are the answers to Intimidate.' },
    { name: 'loaded-dice',      pcNotes: 'Not in PC.' },
    { name: 'covert-cloak',     pcNotes: 'Not in PC.' },
    { name: 'eject-button',     pcNotes: 'Not in PC.' },
    { name: 'eject-pack',       pcNotes: 'Not in PC.' },
    // Banned Gen 6/7 mega stones
    { name: 'blazikenite',      pcNotes: 'Not in PC. Mega Blaziken is banned in Pokemon Champions.' },
    { name: 'diancite',         pcNotes: 'Not in PC. Mega Diancie is banned in Pokemon Champions.' },
    { name: 'latiasite',        pcNotes: 'Not in PC. Mega Latias is banned in Pokemon Champions.' },
    { name: 'latiosite',        pcNotes: 'Not in PC. Mega Latios is banned in Pokemon Champions.' },
    { name: 'mawilite',         pcNotes: 'Not in PC. Mega Mawile is banned in Pokemon Champions.' },
    { name: 'metagrossite',     pcNotes: 'Not in PC. Mega Metagross is banned in Pokemon Champions.' },
    { name: 'mewtwonite-x',     pcNotes: 'Not in PC. Mega Mewtwo X is banned in Pokemon Champions.' },
    { name: 'mewtwonite-y',     pcNotes: 'Not in PC. Mega Mewtwo Y is banned in Pokemon Champions.' },
    { name: 'salamencite',      pcNotes: 'Not in PC. Mega Salamence is banned in Pokemon Champions.' },
    { name: 'sceptilite',       pcNotes: 'Not in PC. Mega Sceptile is banned in Pokemon Champions.' },
    { name: 'swampertite',      pcNotes: 'Not in PC. Mega Swampert is banned in Pokemon Champions.' },
];

const GENERIC_UNAVAILABLE_NOTE = 'Not in PC. Not present in the Champions Database held items list.';
const Z_CRYSTAL_NOTE = 'Not in PC. Z-Moves are not a mechanic in Pokemon Champions.';

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

    // 1. Reset to defaults so removed entries clear correctly on re-run.
    await db.execute(sql`UPDATE items SET pc_available = 1, pc_notes = NULL`);

    // 2. Insert PC-only items (idempotent via ON DUPLICATE KEY UPDATE).
    let additionsApplied = 0;
    for (const item of PC_ITEM_ADDITIONS) {
        await db.execute(sql`
            INSERT INTO items (id, name, display_name, category, cost, fling_power, short_effect, effect, is_holdable, pc_available, pc_notes)
            VALUES (${item.id}, ${item.name}, ${item.displayName}, ${item.category}, 0, ${item.flingPower}, ${item.shortEffect}, ${item.effect}, 1, 1, NULL)
            ON DUPLICATE KEY UPDATE
                display_name = VALUES(display_name),
                category = VALUES(category),
                fling_power = VALUES(fling_power),
                short_effect = VALUES(short_effect),
                effect = VALUES(effect),
                is_holdable = 1,
                pc_available = 1,
                pc_notes = NULL
        `);
        additionsApplied++;
    }

    // 3. Bulk audit: every is_holdable=1 item NOT in the sheet whitelist is PC-banned.
    const whitelistArr = Array.from(PC_HELD_ITEM_SLUGS);
    const auditResult = await db
        .update(ItemsTable)
        .set({ pcAvailable: 0, pcNotes: GENERIC_UNAVAILABLE_NOTE })
        .where(and(eq(ItemsTable.isHoldable, 1), notInArray(ItemsTable.name, whitelistArr)));
    const auditAffected = (auditResult as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;

    // 4. Apply specific detailed notes (overlays the generic note for high-impact items).
    let specificApplied = 0;
    const missing: string[] = [];
    for (const note of SPECIFIC_NOTES) {
        const result = await db
            .update(ItemsTable)
            .set({ pcAvailable: 0, pcNotes: note.pcNotes })
            .where(eq(ItemsTable.name, note.name));
        const affected = (result as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;
        if (affected === 0) missing.push(note.name);
        else specificApplied++;
    }

    // 5. Z-crystals: blanket update with Z-Moves-specific note (overrides generic).
    const zCrystalResult = await db
        .update(ItemsTable)
        .set({ pcAvailable: 0, pcNotes: Z_CRYSTAL_NOTE })
        .where(eq(ItemsTable.category, 'z-crystals'));
    const zCrystalAffected = (zCrystalResult as unknown as [mysql.ResultSetHeader])[0]?.affectedRows ?? 0;

    // 6. Sanity: confirm every whitelisted slug is actually in the items table.
    const [whitelistRows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT name FROM items WHERE name IN (?)',
        [whitelistArr],
    );
    const whitelistFound = new Set(whitelistRows.map((r) => r.name as string));
    const whitelistMissing = whitelistArr.filter((s) => !whitelistFound.has(s));

    console.log(`PC item additions inserted:    ${additionsApplied}/${PC_ITEM_ADDITIONS.length}`);
    console.log(`Bulk audit (is_holdable=1, not in sheet): ${auditAffected} flagged unavailable`);
    console.log(`Specific notes applied:        ${specificApplied}/${SPECIFIC_NOTES.length}`);
    console.log(`Z-crystals marked:             ${zCrystalAffected}`);
    console.log(`Whitelist size:                ${whitelistArr.length}`);

    if (missing.length) {
        console.warn(`\nWARNING: SPECIFIC_NOTES not found: ${missing.join(', ')}`);
    }
    if (whitelistMissing.length) {
        console.warn(`\nWARNING: whitelist slugs not in items table: ${whitelistMissing.join(', ')}`);
        console.warn('Did you run sync:items? If a sheet item was renamed in PokeAPI, update PC_HELD_ITEM_SLUGS or add to PC_ITEM_ADDITIONS.');
    }

    await touchMetadata(db, 'last_pc_overlay_sync');
    await conn.end();
    if (missing.length || whitelistMissing.length) process.exit(1);
}

main().catch((err) => {
    console.error('PC overlay failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
