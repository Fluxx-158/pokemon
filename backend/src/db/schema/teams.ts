import {
    datetime,
    index,
    int,
    json,
    mysqlTable,
    unique,
    varchar,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { AbilitiesTable } from './abilities';
import { ItemsTable } from './items';
import { MovesTable } from './moves';
import { PokemonTable } from './pokemon';

export interface TeamNotesJson {
    lead_pair?: string;
    back_pair?: string;
    mega_holder?: string;
    other?: string[];
}

export const TeamsTable = mysqlTable(
    'teams',
    {
        id: int('id').primaryKey().autoincrement(),
        name: varchar('name', { length: 128 }).notNull(),
        // Relative folder path under Teams/, e.g. "Mega greninja". Multiple
        // teams may share the same human name; the folder is what disambiguates
        // them on disk and pins the seeder back to the source markdown.
        sourceFolder: varchar('source_folder', { length: 255 }).notNull().unique(),
        notes: json('notes').$type<TeamNotesJson>(),
        createdAt: datetime('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
        updatedAt: datetime('updated_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    },
);

export const TeamMembersTable = mysqlTable(
    'team_members',
    {
        id: int('id').primaryKey().autoincrement(),
        teamId: int('team_id').notNull().references(() => TeamsTable.id, { onDelete: 'cascade' }),
        slot: int('slot').notNull(),
        pokemonId: int('pokemon_id').notNull().references(() => PokemonTable.id),
        abilityId: int('ability_id').notNull().references(() => AbilitiesTable.id),
        // Held item is optional in mainline; current PC teams always run one,
        // but we don't want to forbid a future PC ruleset that allows
        // item-less mons. Nullable.
        itemId: int('item_id').references(() => ItemsTable.id),
        nature: varchar('nature', { length: 16 }).notNull(),
    },
    (table) => ({
        teamSlotUnique: unique('uq_tm_team_slot').on(table.teamId, table.slot),
        pokemonIdx: index('idx_tm_pokemon').on(table.pokemonId),
    }),
);

// EVs and IVs live in dedicated tables so team_members stays free of
// stat-related NULLs and we can omit IV rows entirely for PC teams (PC defaults
// every IV to 31; absence of a row means "use the format default").
export const TeamMemberEvsTable = mysqlTable(
    'team_member_evs',
    {
        id: int('id').primaryKey().autoincrement(),
        teamMemberId: int('team_member_id').notNull().unique().references(() => TeamMembersTable.id, { onDelete: 'cascade' }),
        hp: int('hp').notNull().default(0),
        atk: int('atk').notNull().default(0),
        def: int('def').notNull().default(0),
        spa: int('spa').notNull().default(0),
        spd: int('spd').notNull().default(0),
        spe: int('spe').notNull().default(0),
    },
);

export const TeamMemberIvsTable = mysqlTable(
    'team_member_ivs',
    {
        id: int('id').primaryKey().autoincrement(),
        teamMemberId: int('team_member_id').notNull().unique().references(() => TeamMembersTable.id, { onDelete: 'cascade' }),
        hp: int('hp').notNull().default(31),
        atk: int('atk').notNull().default(31),
        def: int('def').notNull().default(31),
        spa: int('spa').notNull().default(31),
        spd: int('spd').notNull().default(31),
        spe: int('spe').notNull().default(31),
    },
);

export const TeamMemberMovesTable = mysqlTable(
    'team_member_moves',
    {
        id: int('id').primaryKey().autoincrement(),
        teamMemberId: int('team_member_id').notNull().references(() => TeamMembersTable.id, { onDelete: 'cascade' }),
        slot: int('slot').notNull(),
        moveId: int('move_id').notNull().references(() => MovesTable.id),
    },
    (table) => ({
        memberSlotUnique: unique('uq_tmm_member_slot').on(table.teamMemberId, table.slot),
        moveIdx: index('idx_tmm_move').on(table.moveId),
    }),
);
