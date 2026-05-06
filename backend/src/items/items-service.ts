import { Injectable } from '@nestjs/common';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { Datasource } from '../db/datasource';
import { ItemsTable } from '../db/schema/items';

export interface ItemListItem {
    id: number;
    name: string;
    displayName: string;
    category: string;
    isHoldable: boolean;
    pcAvailable: boolean;
    shortEffect: string | null;
    pcNotes: string | null;
}

@Injectable()
export class ItemsService {
    constructor(private readonly datasource: Datasource) {}

    async findAll(opts: { holdable?: boolean; pcOnly?: boolean } = {}): Promise<ItemListItem[]> {
        const conditions: SQL[] = [];
        if (opts.holdable) conditions.push(eq(ItemsTable.isHoldable, 1));
        if (opts.pcOnly) conditions.push(eq(ItemsTable.pcAvailable, 1));

        let query = this.datasource.db
            .select({
                id: ItemsTable.id,
                name: ItemsTable.name,
                displayName: ItemsTable.displayName,
                category: ItemsTable.category,
                isHoldable: ItemsTable.isHoldable,
                pcAvailable: ItemsTable.pcAvailable,
                shortEffect: ItemsTable.shortEffect,
                pcNotes: ItemsTable.pcNotes,
            })
            .from(ItemsTable)
            .$dynamic();

        if (conditions.length === 1) {
            query = query.where(conditions[0]);
        } else if (conditions.length > 1) {
            query = query.where(and(...conditions));
        }

        const rows = await query.orderBy(asc(ItemsTable.displayName));

        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            displayName: r.displayName,
            category: r.category,
            isHoldable: r.isHoldable === 1,
            pcAvailable: r.pcAvailable === 1,
            shortEffect: r.shortEffect,
            pcNotes: r.pcNotes,
        }));
    }
}
