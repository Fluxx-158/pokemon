import { mysqlTable, int, varchar, text, tinyint } from 'drizzle-orm/mysql-core';

export const MovesTable = mysqlTable('moves', {
    id: int('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull().unique(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    typeName: varchar('type_name', { length: 32 }).notNull(),
    damageClass: varchar('damage_class', { length: 16 }).notNull(),
    power: int('power'),
    accuracy: int('accuracy'),
    ppMainline: int('pp_mainline').notNull(),
    ppPc: int('pp_pc').notNull(),
    priority: int('priority').notNull(),
    target: varchar('target', { length: 48 }).notNull(),
    effectChance: int('effect_chance'),
    shortEffect: text('short_effect'),
    effect: text('effect'),
    generation: int('generation'),
    isSlicing: tinyint('is_slicing').notNull().default(0),
    pcChanged: tinyint('pc_changed').notNull().default(0),
    pcNotes: text('pc_notes'),
});
