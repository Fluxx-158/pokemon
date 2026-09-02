// F2 phase 2: ingest Champions Reg M-B tournament results from Limitless
// (play.limitlesstcg.com) into meta_species. Aggregates the most recent N
// tournaments' decklists into per-species usage%, team win rate, and teammate
// cores, then upserts (Limitless columns only, so a later Pikalytics sync can
// coexist on the same row). Public JSON, no key; we keep concurrency low and
// back off on failures to respect the source.

import { eq, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { MetaSpeciesTable } from '../db/schema/meta-species';
import { loadPokemonResolver } from '../usage/usage-sync';
import {
    aggregateStandings, toUsageRows, emptyAggregate,
    type LimitlessStanding, type TournamentAggregate,
} from './tournament-aggregate';

const API_BASE = 'https://play.limitlesstcg.com/api';
const GAME = 'VGC';        // Champions lives under game=VGC on Limitless
const FORMAT = 'M-B';      // current Champions regulation
const DEFAULT_MAX_TOURNAMENTS = 40;
const FETCH_CONCURRENCY = 4;

interface TournamentListEntry { id: string; name: string; date: string; game: string; format: string; players: number; }

export interface TournamentSyncSummary {
    tournamentsConsidered: number;
    tournamentsAggregated: number;
    totalDecklists: number;
    speciesStored: number;
    unresolved: string[];       // species names that didn't map to a pokemon.id
    fetchFailures: string[];    // tournament ids whose standings failed
}

export interface TournamentSyncOptions {
    fetchImpl?: typeof fetch;
    log?: (msg: string) => void;
    maxTournaments?: number;
    concurrency?: number;
}

async function fetchWithRetry<T>(fetchImpl: typeof fetch, url: string, maxRetries = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetchImpl(url, { headers: { 'User-Agent': 'pokemon-champions-app/1.0' } });
            if (res.status === 429) throw new Error(`HTTP 429 (rate limited) for ${url}`);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
            return (await res.json()) as T;
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 700 * 2 ** attempt));
        }
    }
    throw lastErr;
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(fn));
    }
}

export async function runTournamentSync(db: MySql2Database<any>, opts: TournamentSyncOptions = {}): Promise<TournamentSyncSummary> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const log = opts.log ?? (() => {});
    const maxTournaments = opts.maxTournaments ?? DEFAULT_MAX_TOURNAMENTS;
    const concurrency = opts.concurrency ?? FETCH_CONCURRENCY;

    log(`Fetching Limitless ${GAME}/${FORMAT} tournaments…`);
    const list = await fetchWithRetry<TournamentListEntry[]>(
        fetchImpl, `${API_BASE}/tournaments?game=${GAME}&format=${FORMAT}&limit=${maxTournaments}`,
    );
    const tournaments = (list ?? []).slice(0, maxTournaments);
    log(`  ${tournaments.length} tournaments to aggregate`);

    const agg: TournamentAggregate = emptyAggregate();
    const fetchFailures: string[] = [];
    let aggregated = 0;

    await inBatches(tournaments, concurrency, async (t) => {
        try {
            const standings = await fetchWithRetry<LimitlessStanding[]>(fetchImpl, `${API_BASE}/tournaments/${t.id}/standings`);
            aggregateStandings(standings ?? [], agg);
            aggregated++;
        } catch {
            fetchFailures.push(t.id);
        }
    });

    // Never wipe good data on a fully-failed pull.
    if (agg.totalDecklists === 0) {
        throw new Error(
            `Aborting tournament sync: aggregated 0 decklists `
            + `(${tournaments.length} tournaments, ${fetchFailures.length} failed). Existing data left untouched.`,
        );
    }

    const rows = toUsageRows(agg);
    const resolve = await loadPokemonResolver(db);
    const unresolved: string[] = [];

    // Resolve each ranked species to a pokemon.id; keep usage% (denominator is
    // all decklists, computed pre-resolution) and resolve teammate ids too.
    const upserts = rows.map((r) => {
        const pokemonId = resolve(r.rawName) ?? resolve(r.key);
        if (pokemonId === null) { unresolved.push(r.rawName); return null; }
        const teammates = r.topTeammates.map((t) => ({
            pokemonId: resolve(t.rawName) ?? resolve(t.key),
            name: t.rawName,
            pct: Math.round(t.pct * 10) / 10,
        }));
        return {
            pokemonId, format: 'doubles' as const, rawName: r.rawName,
            limitlessDecklists: r.decklists,
            limitlessUsagePct: Math.round(r.usagePct * 100) / 100,
            limitlessTeamWinPct: r.teamWinPct === null ? null : Math.round(r.teamWinPct * 100) / 100,
            limitlessWins: r.wins, limitlessLosses: r.losses,
            topTeammates: JSON.stringify(teammates),
        };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    // Clear stale Limitless columns for doubles (species that dropped out of the
    // meta) but keep any Pikalytics data on the row, then upsert the fresh set.
    await db.update(MetaSpeciesTable)
        .set({
            limitlessDecklists: null, limitlessUsagePct: null, limitlessTeamWinPct: null,
            limitlessWins: null, limitlessLosses: null, topTeammates: null,
        })
        .where(eq(MetaSpeciesTable.format, 'doubles'));

    for (const u of upserts) {
        await db.insert(MetaSpeciesTable)
            .values({ ...u, updatedAt: new Date() })
            .onDuplicateKeyUpdate({
                set: {
                    rawName: u.rawName,
                    limitlessDecklists: u.limitlessDecklists,
                    limitlessUsagePct: u.limitlessUsagePct,
                    limitlessTeamWinPct: u.limitlessTeamWinPct,
                    limitlessWins: u.limitlessWins,
                    limitlessLosses: u.limitlessLosses,
                    topTeammates: u.topTeammates,
                    updatedAt: new Date(),
                },
            });
    }

    await db.execute(
        sql`UPDATE metadata SET last_tournament_sync = NOW(), tournament_sample_decklists = ${agg.totalDecklists}, tournament_count = ${aggregated} WHERE id = 1`,
    );

    return {
        tournamentsConsidered: tournaments.length,
        tournamentsAggregated: aggregated,
        totalDecklists: agg.totalDecklists,
        speciesStored: upserts.length,
        unresolved: [...new Set(unresolved)].sort(),
        fetchFailures,
    };
}
