// F2 phase 3: fetch Pikalytics' per-battle win rate for the meta-relevant
// species and merge it onto the existing meta_species rows (Pikalytics columns
// only, leaving the Limitless aggregation intact). Targets are drawn from the
// species the tournament sync already ranked, so run sync:tournaments first.
// Data courtesy of Pikalytics (pikalytics.com); attribution is required in the UI.

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { MetaSpeciesTable } from '../db/schema/meta-species';
import { parsePikalytics, pikalyticsSlugCandidates } from './pikalytics-parse';

const AI_BASE = 'https://www.pikalytics.com/ai/pokedex/battledataregmbs3';
const DEFAULT_MAX_SPECIES = 80;
const CONCURRENCY = 3;

export interface PikalyticsSyncSummary {
    attempted: number;
    updated: number;
    missing: string[];      // species with no parseable win rate (skipped)
    dataDate: string | null;
}

export interface PikalyticsSyncOptions {
    fetchImpl?: typeof fetch;
    log?: (msg: string) => void;
    maxSpecies?: number;
    concurrency?: number;
}

async function fetchText(fetchImpl: typeof fetch, url: string, maxRetries = 2): Promise<string | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetchImpl(url, { headers: { 'User-Agent': 'pokemon-champions-app/1.0' } });
            if (res.status === 404) return null;         // no page for this species
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch {
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
        }
    }
    return null;
}

// Fetch the first slug candidate that yields a parseable win rate.
async function fetchStats(fetchImpl: typeof fetch, rawName: string) {
    for (const slug of pikalyticsSlugCandidates(rawName)) {
        const md = await fetchText(fetchImpl, `${AI_BASE}/${encodeURIComponent(slug)}`);
        const stats = md ? parsePikalytics(md) : null;
        if (stats && stats.winPct !== null) return stats;
    }
    return null;
}

export async function runPikalyticsSync(db: MySql2Database<any>, opts: PikalyticsSyncOptions = {}): Promise<PikalyticsSyncSummary> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const log = opts.log ?? (() => {});
    const maxSpecies = opts.maxSpecies ?? DEFAULT_MAX_SPECIES;
    const concurrency = opts.concurrency ?? CONCURRENCY;

    // Target the top meta species (by Limitless usage) so we bound the scrape.
    const targets = await db
        .select({ pokemonId: MetaSpeciesTable.pokemonId, rawName: MetaSpeciesTable.rawName })
        .from(MetaSpeciesTable)
        .where(and(eq(MetaSpeciesTable.format, 'doubles'), isNotNull(MetaSpeciesTable.limitlessUsagePct)))
        .orderBy(desc(MetaSpeciesTable.limitlessUsagePct))
        .limit(maxSpecies);

    log(`Pikalytics win-rate for top ${targets.length} species…`);

    const missing: string[] = [];
    let updated = 0;
    let dataDate: string | null = null;

    for (let i = 0; i < targets.length; i += concurrency) {
        const batch = targets.slice(i, i + concurrency);
        await Promise.all(batch.map(async (t) => {
            const stats = await fetchStats(fetchImpl, t.rawName);
            if (!stats || stats.winPct === null) { missing.push(t.rawName); return; }
            if (!dataDate && stats.dataDate) dataDate = stats.dataDate;
            await db.update(MetaSpeciesTable)
                .set({
                    pikalyticsWinPct: stats.winPct,
                    pikalyticsRecord: stats.record,
                    pikalyticsDataDate: stats.dataDate,
                    updatedAt: new Date(),
                })
                .where(and(eq(MetaSpeciesTable.pokemonId, t.pokemonId), eq(MetaSpeciesTable.format, 'doubles')));
            updated++;
        }));
        if ((i / concurrency) % 5 === 0) log(`  ${Math.min(i + concurrency, targets.length)}/${targets.length}`);
    }

    if (updated > 0) {
        await db.execute(sql`UPDATE metadata SET last_winrate_sync = NOW(), winrate_source_data_date = ${dataDate} WHERE id = 1`);
    }

    return { attempted: targets.length, updated, missing: missing.sort(), dataDate };
}
