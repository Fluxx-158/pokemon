import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/db/client';
import { MegaEvolutionsTable } from '../src/db/schema/mega-evolutions';
import { touchMetadata } from '../src/db/metadata-write';

interface MegaMapping {
    stone: string;        // items.name slug
    base: string;         // pokemon.name slug (default form)
    mega: string;         // pokemon.name slug (mega form)
    notes?: string;
}

// All known mega evolutions. PokeAPI exposes mega forms but not the stone->mega
// mapping itself, so this list is hand-curated against canonical Pokemon
// mythology (Bulbapedia / Serebii / Champions Database).
//
// Includes Z-A additions seeded via pc-overlay-items.ts (synthetic IDs 100001+).
// Stones for the 11 canonical Gen 6/7 megas banned in PC (blazikenite, diancite,
// latiasite, latiosite, mawilite, metagrossite, mewtwonite-x/y, salamencite,
// sceptilite, swampertite) are flagged pc_available=0 in items but the
// mega_evolutions rows are kept for completeness — filter via the JOIN to
// items.pc_available when querying for PC-legal megas only.
const MAPPINGS: MegaMapping[] = [
    // Gen 6/7 canonical (47 stones from PokeAPI).
    { stone: 'venusaurite',     base: 'venusaur',     mega: 'venusaur-mega' },
    { stone: 'charizardite-x',  base: 'charizard',    mega: 'charizard-mega-x' },
    { stone: 'charizardite-y',  base: 'charizard',    mega: 'charizard-mega-y' },
    { stone: 'blastoisinite',   base: 'blastoise',    mega: 'blastoise-mega' },
    { stone: 'beedrillite',     base: 'beedrill',     mega: 'beedrill-mega' },
    { stone: 'pidgeotite',      base: 'pidgeot',      mega: 'pidgeot-mega' },
    { stone: 'alakazite',       base: 'alakazam',     mega: 'alakazam-mega' },
    { stone: 'slowbronite',     base: 'slowbro',      mega: 'slowbro-mega' },
    { stone: 'gengarite',       base: 'gengar',       mega: 'gengar-mega' },
    { stone: 'kangaskhanite',   base: 'kangaskhan',   mega: 'kangaskhan-mega' },
    { stone: 'pinsirite',       base: 'pinsir',       mega: 'pinsir-mega' },
    { stone: 'gyaradosite',     base: 'gyarados',     mega: 'gyarados-mega' },
    { stone: 'aerodactylite',   base: 'aerodactyl',   mega: 'aerodactyl-mega' },
    { stone: 'mewtwonite-x',    base: 'mewtwo',       mega: 'mewtwo-mega-x' },
    { stone: 'mewtwonite-y',    base: 'mewtwo',       mega: 'mewtwo-mega-y' },
    { stone: 'ampharosite',     base: 'ampharos',     mega: 'ampharos-mega' },
    { stone: 'steelixite',      base: 'steelix',      mega: 'steelix-mega' },
    { stone: 'scizorite',       base: 'scizor',       mega: 'scizor-mega' },
    { stone: 'heracronite',     base: 'heracross',    mega: 'heracross-mega' },
    { stone: 'houndoominite',   base: 'houndoom',     mega: 'houndoom-mega' },
    { stone: 'tyranitarite',    base: 'tyranitar',    mega: 'tyranitar-mega' },
    { stone: 'sceptilite',      base: 'sceptile',     mega: 'sceptile-mega' },
    { stone: 'blazikenite',     base: 'blaziken',     mega: 'blaziken-mega' },
    { stone: 'swampertite',     base: 'swampert',     mega: 'swampert-mega' },
    { stone: 'gardevoirite',    base: 'gardevoir',    mega: 'gardevoir-mega' },
    { stone: 'sablenite',       base: 'sableye',      mega: 'sableye-mega' },
    { stone: 'mawilite',        base: 'mawile',       mega: 'mawile-mega' },
    { stone: 'aggronite',       base: 'aggron',       mega: 'aggron-mega' },
    { stone: 'medichamite',     base: 'medicham',     mega: 'medicham-mega' },
    { stone: 'manectite',       base: 'manectric',    mega: 'manectric-mega' },
    { stone: 'sharpedonite',    base: 'sharpedo',     mega: 'sharpedo-mega' },
    { stone: 'cameruptite',     base: 'camerupt',     mega: 'camerupt-mega' },
    { stone: 'altarianite',     base: 'altaria',      mega: 'altaria-mega' },
    { stone: 'banettite',       base: 'banette',      mega: 'banette-mega' },
    { stone: 'absolite',        base: 'absol',        mega: 'absol-mega' },
    { stone: 'glalitite',       base: 'glalie',       mega: 'glalie-mega' },
    { stone: 'salamencite',     base: 'salamence',    mega: 'salamence-mega' },
    { stone: 'metagrossite',    base: 'metagross',    mega: 'metagross-mega' },
    { stone: 'latiasite',       base: 'latias',       mega: 'latias-mega' },
    { stone: 'latiosite',       base: 'latios',       mega: 'latios-mega' },
    { stone: 'lopunnite',       base: 'lopunny',      mega: 'lopunny-mega' },
    { stone: 'garchompite',     base: 'garchomp',     mega: 'garchomp-mega' },
    { stone: 'lucarionite',     base: 'lucario',      mega: 'lucario-mega' },
    { stone: 'abomasite',       base: 'abomasnow',    mega: 'abomasnow-mega' },
    { stone: 'galladite',       base: 'gallade',      mega: 'gallade-mega' },
    { stone: 'audinite',        base: 'audino',       mega: 'audino-mega' },
    { stone: 'diancite',        base: 'diancie',      mega: 'diancie-mega' },
    // Z-A additions (23 stones from Champions Database / pc-overlay-items.ts).
    { stone: 'skarmorite',      base: 'skarmory',     mega: 'skarmory-mega' },
    { stone: 'clefablite',      base: 'clefable',     mega: 'clefable-mega' },
    { stone: 'drampanite',      base: 'drampa',       mega: 'drampa-mega' },
    { stone: 'excadrite',       base: 'excadrill',    mega: 'excadrill-mega' },
    { stone: 'chandelurite',    base: 'chandelure',   mega: 'chandelure-mega' },
    { stone: 'meganiumite',     base: 'meganium',     mega: 'meganium-mega' },
    { stone: 'feraligite',      base: 'feraligatr',   mega: 'feraligatr-mega' },
    { stone: 'emboarite',       base: 'emboar',       mega: 'emboar-mega' },
    { stone: 'victreebelite',   base: 'victreebel',   mega: 'victreebel-mega' },
    { stone: 'hawluchanite',    base: 'hawlucha',     mega: 'hawlucha-mega' },
    { stone: 'dragoninite',     base: 'dragonite',    mega: 'dragonite-mega' },
    { stone: 'froslassite',     base: 'froslass',     mega: 'froslass-mega' },
    { stone: 'starminite',      base: 'starmie',      mega: 'starmie-mega' },
    // Floettite has two valid bases: regular Floette and Eternal Flower Floette
    // (the meta-relevant form). Both produce the same Mega Floette form.
    { stone: 'floettite',       base: 'floette',          mega: 'floette-mega', notes: 'Reachable from regular Floette.' },
    { stone: 'floettite',       base: 'floette-eternal',  mega: 'floette-mega', notes: 'Reachable from Eternal Flower Floette (the meta-relevant form).' },
    { stone: 'greninjite',      base: 'greninja',     mega: 'greninja-mega' },
    { stone: 'delphoxite',      base: 'delphox',      mega: 'delphox-mega' },
    { stone: 'chesnaughtite',   base: 'chesnaught',   mega: 'chesnaught-mega' },
    { stone: 'chimechite',      base: 'chimecho',     mega: 'chimecho-mega' },
    { stone: 'crabominite',     base: 'crabominable', mega: 'crabominable-mega' },
    { stone: 'glimmoranite',    base: 'glimmora',     mega: 'glimmora-mega' },
    { stone: 'golurkite',       base: 'golurk',       mega: 'golurk-mega' },
    { stone: 'meowsticite',     base: 'meowstic-male', mega: 'meowstic-mega' },
    { stone: 'scovillainite',   base: 'scovillain',   mega: 'scovillain-mega' },
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

    // Build lookups.
    const [pokemonRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, name FROM pokemon');
    const pokemonIds: Record<string, number> = {};
    for (const r of pokemonRows) pokemonIds[r.name] = r.id;

    const [itemRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, name FROM items');
    const itemIds: Record<string, number> = {};
    for (const r of itemRows) itemIds[r.name] = r.id;

    const rows: { basePokemonId: number; megaPokemonId: number; megaStoneId: number; notes: string | null }[] = [];
    const missing: string[] = [];

    for (const m of MAPPINGS) {
        const stone = itemIds[m.stone];
        const base = pokemonIds[m.base];
        const mega = pokemonIds[m.mega];
        if (!stone) missing.push(`item:${m.stone}`);
        if (!base) missing.push(`pokemon:${m.base}`);
        if (!mega) missing.push(`pokemon:${m.mega}`);
        if (!stone || !base || !mega) continue;
        rows.push({ basePokemonId: base, megaPokemonId: mega, megaStoneId: stone, notes: m.notes ?? null });
    }

    if (missing.length) {
        console.error('Missing references — aborting:');
        for (const x of missing) console.error(`  - ${x}`);
        await conn.end();
        process.exit(1);
    }

    // Idempotent re-seed: clear table and reset autoincrement.
    await db.execute(sql`DELETE FROM mega_evolutions`);
    await db.execute(sql`ALTER TABLE mega_evolutions AUTO_INCREMENT = 1`);

    await db.insert(MegaEvolutionsTable).values(rows);

    console.log(`Inserted ${rows.length} mega evolutions`);
    await touchMetadata(db, 'last_mega_evolutions_seed');
    await conn.end();
}

main().catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
