import { mysqlTable, int, varchar, text, tinyint, primaryKey, index } from 'drizzle-orm/mysql-core';
import { TypesTable } from './types';
import { AbilitiesTable } from './abilities';
import { MovesTable } from './moves';

export const PokemonTable = mysqlTable(
    'pokemon',
    {
        id: int('id').primaryKey(),
        speciesId: int('species_id').notNull(),
        name: varchar('name', { length: 96 }).notNull().unique(),
        displayName: varchar('display_name', { length: 96 }).notNull(),
        type1Id: int('type1_id').notNull().references(() => TypesTable.id),
        type2Id: int('type2_id').references(() => TypesTable.id),
        baseHp: int('base_hp').notNull(),
        baseAtk: int('base_atk').notNull(),
        baseDef: int('base_def').notNull(),
        baseSpa: int('base_spa').notNull(),
        baseSpd: int('base_spd').notNull(),
        baseSpe: int('base_spe').notNull(),
        bst: int('bst').notNull(),
        height: int('height').notNull(),
        weight: int('weight').notNull(),
        generation: int('generation'),
        isDefault: tinyint('is_default').notNull().default(0),
        isMega: tinyint('is_mega').notNull().default(0),
        isRegional: tinyint('is_regional').notNull().default(0),
        regionVariant: varchar('region_variant', { length: 16 }),
        pcAvailable: tinyint('pc_available').notNull().default(1),
        pcNotes: text('pc_notes'),
    },
    (table) => ({
        speciesIdx: index('idx_pokemon_species').on(table.speciesId),
        type1Idx: index('idx_pokemon_type1').on(table.type1Id),
        type2Idx: index('idx_pokemon_type2').on(table.type2Id),
    }),
);

export const PokemonAbilitiesTable = mysqlTable(
    'pokemon_abilities',
    {
        pokemonId: int('pokemon_id').notNull().references(() => PokemonTable.id, { onDelete: 'cascade' }),
        slot: int('slot').notNull(),
        abilityId: int('ability_id').notNull().references(() => AbilitiesTable.id),
        isHidden: tinyint('is_hidden').notNull().default(0),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.pokemonId, table.slot] }),
        abilityIdx: index('idx_pa_ability').on(table.abilityId),
    }),
);

export const PokemonMovesTable = mysqlTable(
    'pokemon_moves',
    {
        pokemonId: int('pokemon_id').notNull().references(() => PokemonTable.id, { onDelete: 'cascade' }),
        moveId: int('move_id').notNull().references(() => MovesTable.id),
        learnMethod: varchar('learn_method', { length: 32 }).notNull(),
        levelLearnedAt: int('level_learned_at').notNull().default(0),
        pcAvailable: tinyint('pc_available').notNull().default(1),
        pcNotes: text('pc_notes'),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.pokemonId, table.moveId] }),
        moveIdx: index('idx_pm_move').on(table.moveId),
    }),
);
