import { mysqlTable, int, varchar, text, tinyint } from 'drizzle-orm/mysql-core';

export const ItemsTable = mysqlTable('items', {
    id: int('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull().unique(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    cost: int('cost').notNull().default(0),
    flingPower: int('fling_power'),
    shortEffect: text('short_effect'),
    effect: text('effect'),
    isHoldable: tinyint('is_holdable').notNull().default(0),
    pcAvailable: tinyint('pc_available').notNull().default(1),
    pcNotes: text('pc_notes'),
});
