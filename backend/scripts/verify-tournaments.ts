import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

// Verifies the F2 phase 2 tournament aggregation landed sanely. Exits non-zero
// on any failure so `sync:tournaments` self-gates.

interface Check { name: string; pass: boolean; detail: string; }

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host, port: config.port, user: config.user,
        password: config.password, database: config.database,
    });

    const checks: Check[] = [];
    const q = async (sqlText: string) => (await conn.query(sqlText))[0] as any[];

    const [{ n: total }] = await q(`SELECT COUNT(*) n FROM meta_species WHERE format='doubles' AND limitless_usage_pct IS NOT NULL`);
    checks.push({ name: 'species stored (doubles)', pass: total >= 100, detail: `${total} (want >=100)` });

    const [{ bad: pctBad }] = await q(`SELECT COUNT(*) bad FROM meta_species WHERE limitless_usage_pct IS NOT NULL AND (limitless_usage_pct < 0 OR limitless_usage_pct > 100)`);
    checks.push({ name: 'usage% within 0..100', pass: pctBad === 0, detail: `${pctBad} out of range` });

    const [{ bad: wrBad }] = await q(`SELECT COUNT(*) bad FROM meta_species WHERE limitless_team_win_pct IS NOT NULL AND (limitless_team_win_pct < 0 OR limitless_team_win_pct > 100)`);
    checks.push({ name: 'team win% within 0..100', pass: wrBad === 0, detail: `${wrBad} out of range` });

    const [top] = await q(`SELECT raw_name, limitless_usage_pct FROM meta_species WHERE format='doubles' AND limitless_usage_pct IS NOT NULL ORDER BY limitless_usage_pct DESC LIMIT 1`);
    checks.push({ name: 'a top species exists with sane usage', pass: !!top && top.limitless_usage_pct > 0 && top.limitless_usage_pct <= 100, detail: top ? `${top.raw_name} @ ${top.limitless_usage_pct}%` : 'none' });

    const [{ n: teammatesOk }] = await q(`SELECT COUNT(*) n FROM meta_species WHERE top_teammates IS NOT NULL AND JSON_VALID(top_teammates)`);
    checks.push({ name: 'top_teammates is valid JSON', pass: teammatesOk >= 100, detail: `${teammatesOk} rows with valid JSON` });

    const [meta] = await q(`SELECT last_tournament_sync, tournament_sample_decklists, tournament_count FROM metadata WHERE id=1`);
    checks.push({ name: 'metadata provenance stamped', pass: !!meta?.last_tournament_sync && meta.tournament_sample_decklists > 0, detail: `sample=${meta?.tournament_sample_decklists}, tournaments=${meta?.tournament_count}` });

    await conn.end();

    let failed = 0;
    for (const c of checks) {
        console.log(`${c.pass ? '[ OK ]' : '[FAIL]'} ${c.name}: ${c.detail}`);
        if (!c.pass) failed++;
    }
    console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
    if (failed > 0) process.exit(1);
}

main().catch((err) => {
    console.error('verify:tournaments failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
