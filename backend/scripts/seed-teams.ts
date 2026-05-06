import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';
import {
    normKey,
    parseTeamMarkdown,
    resolveMembers,
    type Lookups,
    type ParsedTeam,
} from '../src/teams/team-parser';

const TEAMS_ROOT = join(__dirname, '..', '..', 'Teams');
const SKIP_FOLDERS = new Set(['_template']);

async function loadLookups(conn: mysql.Connection): Promise<Lookups> {
    const [pokRows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT id, display_name, is_default FROM pokemon ORDER BY is_default DESC, id ASC',
    );
    const pokemon = new Map<string, number>();
    const pokemonSpecies = new Map<string, number>();
    for (const r of pokRows) {
        const key = normKey(r.display_name);
        if (!pokemon.has(key)) pokemon.set(key, r.id);
        if (r.is_default === 1) {
            const firstWord = String(r.display_name).split(/\s+/)[0];
            const speciesKey = normKey(firstWord);
            if (speciesKey && !pokemonSpecies.has(speciesKey)) {
                pokemonSpecies.set(speciesKey, r.id);
            }
        }
    }

    const [abilityRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, display_name FROM abilities');
    const abilities = new Map<string, number>();
    for (const r of abilityRows) abilities.set(normKey(r.display_name), r.id);

    const [itemRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, display_name FROM items');
    const items = new Map<string, number>();
    for (const r of itemRows) items.set(normKey(r.display_name), r.id);

    const [moveRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, display_name FROM moves');
    const moves = new Map<string, number>();
    for (const r of moveRows) moves.set(normKey(r.display_name), r.id);

    return { pokemon, pokemonSpecies, abilities, items, moves };
}

async function seedTeam(conn: mysql.Connection, parsed: ParsedTeam, lookups: Lookups): Promise<void> {
    // Resolve everything up front — any failure throws before any writes.
    const resolved = resolveMembers(parsed, lookups);

    // Idempotent: delete existing team by source_folder (cascades through members → evs/moves).
    await conn.query('DELETE FROM teams WHERE source_folder = ?', [parsed.sourceFolder]);

    const [insertResult] = await conn.query<mysql.ResultSetHeader>(
        'INSERT INTO teams (name, source_folder, notes) VALUES (?, ?, ?)',
        [parsed.name, parsed.sourceFolder, JSON.stringify(parsed.notes)],
    );
    const teamId = insertResult.insertId;

    for (const m of resolved) {
        const [memberResult] = await conn.query<mysql.ResultSetHeader>(
            'INSERT INTO team_members (team_id, slot, pokemon_id, ability_id, item_id, nature) VALUES (?, ?, ?, ?, ?, ?)',
            [teamId, m.slot, m.pokemonId, m.abilityId, m.itemId, m.nature],
        );
        const memberId = memberResult.insertId;

        await conn.query(
            'INSERT INTO team_member_evs (team_member_id, hp, atk, def, spa, spd, spe) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [memberId, ...m.evs],
        );

        for (let i = 0; i < m.moveIds.length; i++) {
            await conn.query(
                'INSERT INTO team_member_moves (team_member_id, slot, move_id) VALUES (?, ?, ?)',
                [memberId, i + 1, m.moveIds[i]],
            );
        }
    }
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

    const folders = readdirSync(TEAMS_ROOT).filter((entry) => {
        if (SKIP_FOLDERS.has(entry)) return false;
        const full = join(TEAMS_ROOT, entry);
        try {
            return statSync(full).isDirectory();
        } catch {
            return false;
        }
    });

    console.log(`Scanning ${folders.length} team folder(s) under ${TEAMS_ROOT}`);

    const lookups = await loadLookups(conn);
    let ok = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const folder of folders) {
        const teamMd = join(TEAMS_ROOT, folder, 'team.md');
        try {
            const content = readFileSync(teamMd, 'utf8');
            const parsed = parseTeamMarkdown(folder, content);
            await seedTeam(conn, parsed, lookups);
            console.log(`  [OK]   ${folder}: ${parsed.members.length} members`);
            ok++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/ENOENT/.test(msg) && msg.includes('team.md')) {
                console.log(`  [SKIP] ${folder}: no team.md`);
                skipped++;
            } else {
                console.log(`  [FAIL] ${folder}: ${msg}`);
                errors.push(`${folder}: ${msg}`);
            }
        }
    }

    console.log(`\n${ok} seeded, ${skipped} skipped, ${errors.length} errors`);
    await conn.end();
    if (errors.length > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
