import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2';
import { Pool } from 'mysql2';
import { SAFE_CONFIG, SafeConfig } from '../env';

import * as Types from './schema/types';
import * as Abilities from './schema/abilities';
import * as Moves from './schema/moves';
import * as Items from './schema/items';
import * as Pokemon from './schema/pokemon';
import * as MegaEvolutions from './schema/mega-evolutions';
import * as Metadata from './schema/metadata';

let __pool: Pool | undefined;
let __drizzle: Drizzle | undefined;

function createPool(config: SafeConfig): Pool {
    return mysql.createPool({
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
    });
}

function createDatasource(pool: Pool) {
    return drizzle({
        client: pool,
        mode: 'default',
        schema: {
            ...Types,
            ...Abilities,
            ...Moves,
            ...Items,
            ...Pokemon,
            ...MegaEvolutions,
            ...Metadata,
        },
    });
}

export type Drizzle = ReturnType<typeof createDatasource>;

@Injectable()
export class Datasource implements OnModuleInit, OnModuleDestroy {

    constructor(@Inject(SAFE_CONFIG) private readonly config: SafeConfig) {}

    onModuleInit() {
        __pool = createPool(this.config);
        __drizzle = createDatasource(__pool);
    }

    async onModuleDestroy() {
        if (__pool) {
            await __pool.promise().end();
            __pool = undefined;
            __drizzle = undefined;
        }
    }

    get db(): Drizzle {
        if (!__drizzle) {
            throw new Error('Datasource not initialized — onModuleInit has not run yet');
        }
        return __drizzle;
    }
}
