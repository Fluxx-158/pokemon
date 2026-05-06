import { mysqlTable, int, varchar, decimal, primaryKey } from 'drizzle-orm/mysql-core';

export const TypesTable = mysqlTable('types', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 32 }).notNull().unique(),
});

export const TypeChartTable = mysqlTable(
    'type_chart',
    {
        attackerTypeId: int('attacker_type_id').notNull().references(() => TypesTable.id),
        defenderTypeId: int('defender_type_id').notNull().references(() => TypesTable.id),
        multiplier: decimal('multiplier', { precision: 4, scale: 2 }).notNull(),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.attackerTypeId, table.defenderTypeId] }),
    }),
);
