import { mysqlTable, int, text, unique, index } from 'drizzle-orm/mysql-core';
import { PokemonTable } from './pokemon';
import { ItemsTable } from './items';

export const MegaEvolutionsTable = mysqlTable(
    'mega_evolutions',
    {
        id: int('id').primaryKey().autoincrement(),
        basePokemonId: int('base_pokemon_id').notNull().references(() => PokemonTable.id, { onDelete: 'cascade' }),
        megaPokemonId: int('mega_pokemon_id').notNull().references(() => PokemonTable.id, { onDelete: 'cascade' }),
        megaStoneId: int('mega_stone_id').notNull().references(() => ItemsTable.id),
        notes: text('notes'),
    },
    (table) => ({
        baseStoneUnique: unique('uq_me_base_stone').on(table.basePokemonId, table.megaStoneId),
        // No unique on mega_pokemon_id: a single mega form can be reached from
        // multiple base forms (e.g. Floette and Floette-Eternal both produce
        // Mega Floette via Floettite).
        megaIdx: index('idx_me_mega').on(table.megaPokemonId),
        stoneIdx: index('idx_me_stone').on(table.megaStoneId),
    }),
);
