import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Datasource } from './db/datasource';

@Controller()
export class AppController {

    constructor(private readonly datasource: Datasource) {}

    @Get('health')
    health() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    @Get('health/db')
    async healthDb() {
        await this.datasource.db.execute(sql`SELECT 1`);
        return {
            status: 'ok',
            db: 'connected',
            timestamp: new Date().toISOString(),
        };
    }
}
