import { mysqlTable, int, varchar, float, index } from 'drizzle-orm/mysql-core';
import { PokemonTable } from './pokemon';

// Competitive usage data ingested from championsbattledata.com (the in-game
// ranked Battle Data). One row per (pokemon, format, category, rank), a
// flattened mirror of the source's uniform `rows[]` shape, which uses a
// `category` discriminator rather than per-category tables.
//
// HYBRID storage (feature-plan F2 OQ2): every row keeps the raw source `name`
// string AND a nullable `refId` resolved into the category's own table, 
// move→moves, held_item→items, ability→abilities, teammate→pokemon. `refId`
// is a plain int (no FK constraint) because the referenced table varies by
// category; it's null for stat_alignment/stat_points and for names we couldn't
// resolve. The sync truncates + reinserts wholesale, so no unique constraint.

export type UsageFormat = 'doubles' | 'singles';

export type UsageCategory =
    | 'move'
    | 'held_item'
    | 'ability'
    | 'stat_alignment' // nature (with statUp/statDown)
    | 'stat_points'    // EV-style spread (ev* columns)
    | 'teammate';

export const PokemonUsageTable = mysqlTable(
    'pokemon_usage',
    {
        id: int('id').primaryKey().autoincrement(),
        // Subject Pokemon (the roster entry these stats describe), resolved to
        // our pokemon.id. Rows whose roster name doesn't resolve are skipped.
        pokemonId: int('pokemon_id').notNull().references(() => PokemonTable.id, { onDelete: 'cascade' }),
        format: varchar('format', { length: 8 }).notNull().$type<UsageFormat>(),
        category: varchar('category', { length: 16 }).notNull().$type<UsageCategory>(),
        rank: int('rank').notNull(),
        // Raw source name ('' for stat_points). Always kept so unresolved refs
        // are still displayable.
        name: varchar('name', { length: 96 }).notNull().default(''),
        // Resolved id into the category's table (moves/items/abilities/pokemon);
        // null for natures, spreads, and unresolved names.
        refId: int('ref_id'),
        // percentage_value from the source (0-100). Null for teammate rows
        // (the source ranks teammates without a percentage).
        percentage: float('percentage'),
        // stat_alignment only: the nature's boosted / lowered stat names.
        natureUp: varchar('nature_up', { length: 12 }),
        natureDown: varchar('nature_down', { length: 12 }),
        // stat_points only: the EV-style spread (Champions stat points, 0-32 each).
        evHp: int('ev_hp'),
        evAtk: int('ev_atk'),
        evDef: int('ev_def'),
        evSpa: int('ev_spa'),
        evSpd: int('ev_spd'),
        evSpe: int('ev_spe'),
    },
    (table) => ({
        pokemonFormatIdx: index('idx_usage_pokemon_format').on(table.pokemonId, table.format),
        pokemonFormatCatIdx: index('idx_usage_pokemon_format_cat').on(table.pokemonId, table.format, table.category),
        refIdx: index('idx_usage_ref').on(table.category, table.refId),
    }),
);
