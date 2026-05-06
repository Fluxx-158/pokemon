import { Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { Datasource } from '../db/datasource';
import { TypeChartTable, TypesTable } from '../db/schema/types';

export type TypeChart = Record<string, Record<string, number>>;

@Injectable()
export class TypesService {

    constructor(private readonly datasource: Datasource) {}

    async findAll() {
        return this.datasource.db
            .select({
                id: TypesTable.id,
                name: TypesTable.name,
            })
            .from(TypesTable)
            .orderBy(asc(TypesTable.id));
    }

    async getChart(): Promise<TypeChart> {
        const typeRows = await this.datasource.db
            .select({ id: TypesTable.id, name: TypesTable.name })
            .from(TypesTable);

        const typeMap: Record<number, string> = {};
        for (const r of typeRows) {
            typeMap[r.id] = r.name;
        }

        const chartRows = await this.datasource.db
            .select({
                attackerId: TypeChartTable.attackerTypeId,
                defenderId: TypeChartTable.defenderTypeId,
                multiplier: TypeChartTable.multiplier,
            })
            .from(TypeChartTable);

        const chart: TypeChart = {};
        for (const r of chartRows) {
            const attacker = typeMap[r.attackerId];
            const defender = typeMap[r.defenderId];
            if (!chart[attacker]) {
                chart[attacker] = {};
            }
            chart[attacker][defender] = Number(r.multiplier);
        }
        return chart;
    }
}
