// F2 phase 2: pure aggregation of Limitless (play.limitlesstcg.com) Champions
// tournament decklists into per-species meta stats. No network, no DB, so it can
// be unit-tested in isolation; tournament-sync.ts does the fetching + storage.
//
// Source shape: GET /api/tournaments/{id}/standings returns one entry per
// player, each with a `decklist` (6 base-species entries), a `placing`, and a
// win/loss/tie `record`. Mega forms appear as the base species holding a mega
// stone, so species counting keys on the base id (matching our roster).

export interface LimitlessDeckMon {
    id?: string;
    name?: string;
    item?: string | null;
    ability?: string | null;
    attacks?: string[];
    nature?: string | null;
}

export interface LimitlessStanding {
    name?: string;
    decklist?: LimitlessDeckMon[];
    placing?: number;
    record?: { wins?: number; losses?: number; ties?: number } | null;
}

interface SpeciesAgg {
    key: string;
    rawName: string;
    decklists: number;              // decklists containing this species
    wins: number; losses: number; ties: number; // summed over those decklists
    teammates: Map<string, { rawName: string; count: number }>;
}

export interface TournamentAggregate {
    totalDecklists: number;
    species: Map<string, SpeciesAgg>;
}

export function emptyAggregate(): TournamentAggregate {
    return { totalDecklists: 0, species: new Map() };
}

// Base-species key for a decklist entry (Limitless ids are lowercase slugs like
// "charizard"; fall back to the display name). Mega stones live in `item`, so
// the species itself is always the base form.
export function deckMonKey(m: LimitlessDeckMon): string {
    return (m.id || m.name || '').toLowerCase().trim();
}

// Fold a batch of standings into the running aggregate. Decklists with no
// visible species (hidden/incomplete lists) are skipped so they don't dilute
// usage%. Safe to call repeatedly across tournaments with the same accumulator.
export function aggregateStandings(standings: LimitlessStanding[], into?: TournamentAggregate): TournamentAggregate {
    const agg = into ?? emptyAggregate();
    for (const s of standings) {
        const deck = s.decklist ?? [];
        // Distinct species in this decklist (guards against dupes in the source).
        const present = new Map<string, string>(); // key -> rawName
        for (const m of deck) {
            const key = deckMonKey(m);
            if (key) present.set(key, m.name || m.id || key);
        }
        if (present.size === 0) continue;

        agg.totalDecklists++;
        const rec = s.record ?? {};
        const wins = rec.wins ?? 0, losses = rec.losses ?? 0, ties = rec.ties ?? 0;

        for (const [key, rawName] of present) {
            let sp = agg.species.get(key);
            if (!sp) {
                sp = { key, rawName, decklists: 0, wins: 0, losses: 0, ties: 0, teammates: new Map() };
                agg.species.set(key, sp);
            }
            sp.decklists++;
            sp.wins += wins; sp.losses += losses; sp.ties += ties;
            for (const [k2, name2] of present) {
                if (k2 === key) continue;
                const t = sp.teammates.get(k2) ?? { rawName: name2, count: 0 };
                t.count++;
                sp.teammates.set(k2, t);
            }
        }
    }
    return agg;
}

export interface SpeciesUsageRow {
    key: string;
    rawName: string;
    decklists: number;
    usagePct: number;               // decklists / totalDecklists * 100
    wins: number; losses: number; ties: number;
    // Win rate of TEAMS that ran this species (tournament records attributed to
    // every mon on the team). Distinct from a per-battle species win rate.
    teamWinPct: number | null;      // wins / (wins + losses) * 100; null if no games
    topTeammates: Array<{ key: string; rawName: string; pct: number }>;
}

// Rank species by usage; attach team win rate + top co-occurring teammates.
export function toUsageRows(agg: TournamentAggregate, topTeammates = 6): SpeciesUsageRow[] {
    const rows = [...agg.species.values()].map((sp) => {
        const games = sp.wins + sp.losses;
        const teammates = [...sp.teammates.entries()]
            .map(([key, t]) => ({ key, rawName: t.rawName, pct: sp.decklists > 0 ? (t.count / sp.decklists) * 100 : 0 }))
            .sort((a, b) => b.pct - a.pct)
            .slice(0, topTeammates);
        return {
            key: sp.key,
            rawName: sp.rawName,
            decklists: sp.decklists,
            usagePct: agg.totalDecklists > 0 ? (sp.decklists / agg.totalDecklists) * 100 : 0,
            wins: sp.wins, losses: sp.losses, ties: sp.ties,
            teamWinPct: games > 0 ? (sp.wins / games) * 100 : null,
            topTeammates: teammates,
        };
    });
    return rows.sort((a, b) => b.usagePct - a.usagePct || b.decklists - a.decklists);
}
