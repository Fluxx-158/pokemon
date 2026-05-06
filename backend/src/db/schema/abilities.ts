import { mysqlTable, int, varchar, text, tinyint } from 'drizzle-orm/mysql-core';

export const AbilitiesTable = mysqlTable('abilities', {
    id: int('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull().unique(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    shortEffect: text('short_effect'),
    effect: text('effect'),
    generation: int('generation'),
    pcChanged: tinyint('pc_changed').notNull().default(0),
    pcNotes: text('pc_notes'),
});
