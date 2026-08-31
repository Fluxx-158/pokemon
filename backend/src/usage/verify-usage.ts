// Shared usage-data verification. Run by BOTH the CLI (`npm run verify:usage`)
// and the in-app auto-refresh service after each sync, so a bad ingest is caught
// on the cron path too, not just when someone runs the script by hand.
//
// These are regression guards for how this pipeline has actually broken:
//   • 2026-07-24: `index.battleDataFolders` changed meaning (formats → season),
//     the sync resolved 0 formats, truncated, and inserted nothing. The UI just
//     went empty with no error. → populated / coverage / format-balance checks.
//   • Upstream renames would silently tank ref resolution. → resolution-rate.
//   • A switch to mainline-style EVs would silently corrupt every spread and
//     speed calc. → stat-point range check.

import { sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';

export const EXPECTED_CATEGORIES = ['ability', 'held_item', 'move', 'stat_alignment', 'stat_points', 'teammate'];
export const REF_CATEGORIES = ['move', 'held_item', 'ability', 'teammate'];
export const MIN_DISTINCT_POKEMON = 230;
export const MIN_REF_RESOLUTION = 0.90;
export const MIN_FORMAT_SHARE = 0.30;
export const EV_POINT_CAP = 32;

export interface UsageCheck { label: string; ok: boolean; detail?: string; }

export interface UsageVerification {
    stats: {
        total: number;
        distinctPokemon: number;
        byFormat: Array<{ format: string; count: number }>;
        byCategory: Array<{ category: string; count: number }>;
        refResolution: Array<{ category: string; resolved: number; total: number }>;
        lastSync: unknown;
        generatedAt: string | null;
        season: string | null;
    };
    checks: UsageCheck[];
    passed: number;
    failed: number;
}

// drizzle-mysql2's execute() returns the raw driver result ([rows, fields]).
async function rows(db: MySql2Database<any>, query: ReturnType<typeof sql>): Promise<any[]> {
    const res: any = await db.execute(query);
    if (Array.isArray(res)) return (res[0] as any[]) ?? [];
    return (res?.rows as any[]) ?? [];
}

export async function verifyUsage(db: MySql2Database<any>): Promise<UsageVerification> {
    const total = Number((await rows(db, sql`SELECT COUNT(*) AS c FROM pokemon_usage`))[0]?.c ?? 0);
    const distinctPokemon = Number((await rows(db, sql`SELECT COUNT(DISTINCT pokemon_id) AS c FROM pokemon_usage`))[0]?.c ?? 0);

    const byFormat = (await rows(db, sql`SELECT format, COUNT(*) AS c FROM pokemon_usage GROUP BY format ORDER BY format`))
        .map((r) => ({ format: String(r.format), count: Number(r.c) }));
    const byCategory = (await rows(db, sql`SELECT category, COUNT(*) AS c FROM pokemon_usage GROUP BY category ORDER BY category`))
        .map((r) => ({ category: String(r.category), count: Number(r.c) }));
    const refResolution = (await rows(db, sql`
        SELECT category, SUM(ref_id IS NOT NULL) AS resolved, COUNT(*) AS total
        FROM pokemon_usage
        WHERE category IN ('move','held_item','ability','teammate')
        GROUP BY category ORDER BY category`))
        .map((r) => ({ category: String(r.category), resolved: Number(r.resolved), total: Number(r.total) }));

    const metaRow = (await rows(db, sql`
        SELECT last_usage_sync, usage_source_generated_at, usage_source_season FROM metadata WHERE id = 1`))[0] ?? {};
    const evMax = (await rows(db, sql`
        SELECT MAX(GREATEST(COALESCE(ev_hp,0),COALESCE(ev_atk,0),COALESCE(ev_def,0),
                            COALESCE(ev_spa,0),COALESCE(ev_spd,0),COALESCE(ev_spe,0))) AS m
        FROM pokemon_usage WHERE category = 'stat_points'`))[0]?.m;
    const pctBad = Number((await rows(db, sql`
        SELECT COUNT(*) AS c FROM pokemon_usage
        WHERE percentage IS NOT NULL AND (percentage < 0 OR percentage > 100)`))[0]?.c ?? 0);

    const garItem = (await rows(db, sql`
        SELECT u.name FROM pokemon_usage u JOIN pokemon p ON p.id = u.pokemon_id
        WHERE p.name = 'garchomp' AND u.format = 'doubles' AND u.category = 'held_item'
        ORDER BY u.rank LIMIT 1`))[0];
    const garSpread = (await rows(db, sql`
        SELECT u.ev_atk, u.ev_spe FROM pokemon_usage u JOIN pokemon p ON p.id = u.pokemon_id
        WHERE p.name = 'garchomp' AND u.format = 'doubles' AND u.category = 'stat_points'
        ORDER BY u.rank LIMIT 1`))[0];
    const garTeam = Number((await rows(db, sql`
        SELECT COUNT(*) AS c FROM pokemon_usage u JOIN pokemon p ON p.id = u.pokemon_id
        WHERE p.name = 'garchomp' AND u.format = 'doubles' AND u.category = 'teammate'`))[0]?.c ?? 0);

    const checks: UsageCheck[] = [];
    const add = (label: string, ok: boolean, detail?: string) => checks.push({ label, ok, detail });

    // Structural
    add('Table is populated', total > 0, `${total} rows`);
    add(`Coverage >= ${MIN_DISTINCT_POKEMON} distinct pokemon`, distinctPokemon >= MIN_DISTINCT_POKEMON, `${distinctPokemon} distinct`);

    const fmtNames = byFormat.map((f) => f.format).sort();
    add('Both formats present', fmtNames.join(',') === 'doubles,singles', fmtNames.join(',') || 'none');
    for (const f of byFormat) {
        const share = total > 0 ? f.count / total : 0;
        add(`Format "${f.format}" holds a fair share`, share >= MIN_FORMAT_SHARE, `${(share * 100).toFixed(1)}%`);
    }

    const catNames = new Set(byCategory.map((c) => c.category));
    for (const c of EXPECTED_CATEGORIES) add(`Category present: ${c}`, catNames.has(c));

    // Provenance
    add('last_usage_sync stamped', metaRow.last_usage_sync != null);
    add('source generatedAt stamped', !!metaRow.usage_source_generated_at);
    add('source season stamped', !!metaRow.usage_source_season, String(metaRow.usage_source_season ?? 'null'));

    // Resolution + value sanity
    for (const r of refResolution) {
        const rate = r.total > 0 ? r.resolved / r.total : 0;
        add(`Ref resolution >= ${MIN_REF_RESOLUTION * 100}% for ${r.category}`, rate >= MIN_REF_RESOLUTION, `${(rate * 100).toFixed(1)}%`);
    }
    add(`Stat points within 0..${EV_POINT_CAP}`, evMax != null && Number(evMax) <= EV_POINT_CAP, `max ${evMax}`);
    add('Percentages within 0..100', pctBad === 0, `${pctBad} out of range`);

    // Spot checks
    add('Garchomp doubles has a top item', !!garItem, garItem?.name ?? 'none');
    add('Garchomp doubles top spread invests Atk+Spe',
        (garSpread?.ev_atk ?? 0) > 0 && (garSpread?.ev_spe ?? 0) > 0,
        `atk=${garSpread?.ev_atk} spe=${garSpread?.ev_spe}`);
    add('Garchomp doubles has teammate rows', garTeam > 0, `${garTeam} rows`);

    const failed = checks.filter((c) => !c.ok).length;
    return {
        stats: {
            total, distinctPokemon, byFormat, byCategory, refResolution,
            lastSync: metaRow.last_usage_sync ?? null,
            generatedAt: metaRow.usage_source_generated_at ?? null,
            season: metaRow.usage_source_season ?? null,
        },
        checks,
        passed: checks.length - failed,
        failed,
    };
}
