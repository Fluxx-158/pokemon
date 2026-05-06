import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

interface SpotCheck {
    sourceFolder: string;
    expectMembers?: number;
    expectSlot1Species?: string;        // pokemon.display_name
    expectSlot1Item?: string;            // items.display_name
    expectSlot1MoveCount?: number;
    expectSlot1MoveContains?: string[];  // moves.display_name
    expectAnyEvSum?: number;             // sum of EVs across all members (sanity)
    expectNotesHas?: string[];           // substrings expected in JSON.stringify(notes)
}

const SPOT_CHECKS: SpotCheck[] = [
    {
        sourceFolder: 'Mega greninja',
        expectMembers: 6,
        expectSlot1Species: 'Incineroar',
        expectSlot1Item: 'Sitrus Berry',
        expectSlot1MoveCount: 4,
        expectSlot1MoveContains: ['Parting Shot', 'Throat Chop', 'Flare Blitz', 'Fake Out'],
        expectNotesHas: ['Vanilluxe + Greninja', 'Garchomp + Incineroar'],
    },
    {
        sourceFolder: 'Mega Delphox',
        expectMembers: 6,
    },
    {
        sourceFolder: 'Mega Delphox V2',
        expectMembers: 6,
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

    const [teamRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS c FROM teams');
    const [memberRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS c FROM team_members');
    const [evRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS c FROM team_member_evs');
    const [ivRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS c FROM team_member_ivs');
    const [moveRows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS c FROM team_member_moves');

    console.log(`teams:             ${teamRows[0].c}`);
    console.log(`team_members:      ${memberRows[0].c}  (= teams * 6 if every team is full)`);
    console.log(`team_member_evs:   ${evRows[0].c}  (= members; one EV row per member)`);
    console.log(`team_member_ivs:   ${ivRows[0].c}  (PC defaults to 31s; expected 0 unless a team overrides)`);
    console.log(`team_member_moves: ${moveRows[0].c}  (= sum of moves across members)`);
    console.log('');

    let pass = 0;
    let fail = 0;

    console.log('Spot checks:');
    for (const check of SPOT_CHECKS) {
        const issues: string[] = [];
        const [tRows] = await conn.query<mysql.RowDataPacket[]>(
            'SELECT id, name, notes FROM teams WHERE source_folder = ?',
            [check.sourceFolder],
        );
        if (tRows.length === 0) {
            console.log(`  [FAIL] ${check.sourceFolder}: team not found`);
            fail++;
            continue;
        }
        const team = tRows[0];

        if (check.expectMembers !== undefined) {
            const [mRows] = await conn.query<mysql.RowDataPacket[]>(
                'SELECT COUNT(*) AS c FROM team_members WHERE team_id = ?',
                [team.id],
            );
            if (mRows[0].c !== check.expectMembers) {
                issues.push(`members=${mRows[0].c} (expected ${check.expectMembers})`);
            }
        }

        if (check.expectSlot1Species
            || check.expectSlot1Item
            || check.expectSlot1MoveCount !== undefined
            || check.expectSlot1MoveContains) {
            const [slot1Rows] = await conn.query<mysql.RowDataPacket[]>(
                `SELECT tm.id, p.display_name AS species, i.display_name AS item
                 FROM team_members tm
                 JOIN pokemon p ON p.id = tm.pokemon_id
                 LEFT JOIN items i ON i.id = tm.item_id
                 WHERE tm.team_id = ? AND tm.slot = 1`,
                [team.id],
            );
            if (slot1Rows.length === 0) {
                issues.push('slot 1 not found');
            } else {
                const m = slot1Rows[0];
                if (check.expectSlot1Species && m.species !== check.expectSlot1Species) {
                    issues.push(`slot1 species=${m.species} (expected ${check.expectSlot1Species})`);
                }
                if (check.expectSlot1Item && m.item !== check.expectSlot1Item) {
                    issues.push(`slot1 item=${m.item} (expected ${check.expectSlot1Item})`);
                }

                const [moveRows] = await conn.query<mysql.RowDataPacket[]>(
                    `SELECT mv.display_name AS move
                     FROM team_member_moves tmm
                     JOIN moves mv ON mv.id = tmm.move_id
                     WHERE tmm.team_member_id = ?
                     ORDER BY tmm.slot ASC`,
                    [m.id],
                );
                const moveNames = moveRows.map((r) => r.move as string);
                if (check.expectSlot1MoveCount !== undefined && moveNames.length !== check.expectSlot1MoveCount) {
                    issues.push(`slot1 moves=${moveNames.length} (expected ${check.expectSlot1MoveCount})`);
                }
                if (check.expectSlot1MoveContains) {
                    const set = new Set(moveNames);
                    const missing = check.expectSlot1MoveContains.filter((n) => !set.has(n));
                    if (missing.length) issues.push(`slot1 missing moves: ${missing.join(', ')}`);
                }
            }
        }

        if (check.expectNotesHas) {
            const notesStr = team.notes ? JSON.stringify(team.notes) : '';
            for (const fragment of check.expectNotesHas) {
                if (!notesStr.includes(fragment)) {
                    issues.push(`notes missing fragment "${fragment}"`);
                }
            }
        }

        if (issues.length === 0) {
            console.log(`  [OK  ] ${check.sourceFolder}`);
            pass++;
        } else {
            console.log(`  [FAIL] ${check.sourceFolder}: ${issues.join('; ')}`);
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
