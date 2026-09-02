import { mysqlTable, int, varchar, float, timestamp, text, uniqueIndex, index } from 'drizzle-orm/mysql-core';
import { PokemonTable } from './pokemon';

// F2 phases 2-3: per-species meta stats merged from two external sources, keyed
// by (pokemon_id, format). Limitless (play.limitlesstcg.com tournament
// decklists) fills the usage / team-win / teammates columns; Pikalytics fills
// the per-battle win-rate columns. Each sync upserts only its own columns via
// ON DUPLICATE KEY, so the two sources refresh independently without clobbering
// each other. Rows whose source name doesn't resolve to a pokemon.id are skipped.

export type MetaFormat = 'doubles' | 'singles';

export const MetaSpeciesTable = mysqlTable(
    'meta_species',
    {
        id: int('id').primaryKey().autoincrement(),
        pokemonId: int('pokemon_id').notNull().references(() => PokemonTable.id, { onDelete: 'cascade' }),
        format: varchar('format', { length: 8 }).notNull().$type<MetaFormat>(),
        rawName: varchar('raw_name', { length: 96 }).notNull().default(''),

        // --- Limitless: tournament decklist aggregation ---
        limitlessDecklists: int('limitless_decklists'),
        limitlessUsagePct: float('limitless_usage_pct'),
        // Win rate of TEAMS that ran this species (tournament records attributed
        // to the whole team). Distinct from Pikalytics' per-battle win rate.
        limitlessTeamWinPct: float('limitless_team_win_pct'),
        limitlessWins: int('limitless_wins'),
        limitlessLosses: int('limitless_losses'),
        topTeammates: text('top_teammates'), // JSON: [{ pokemonId, name, pct }]

        // --- Pikalytics: per-battle win rate ---
        pikalyticsWinPct: float('pikalytics_win_pct'),
        pikalyticsRecord: varchar('pikalytics_record', { length: 48 }),
        pikalyticsDataDate: varchar('pikalytics_data_date', { length: 16 }),

        updatedAt: timestamp('updated_at'),
    },
    (t) => ({
        uniq: uniqueIndex('uq_meta_species').on(t.pokemonId, t.format),
        usageIdx: index('idx_meta_usage').on(t.format, t.limitlessUsagePct),
    }),
);
