import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { BackdropsController } from './backdrops/backdrops-controller';
import { BackdropsService } from './backdrops/backdrops-service';
import { Datasource } from './db/datasource';
import { parseEnv, SAFE_CONFIG, safeConfig } from './env';
import { EnvelopInterceptor } from './infrastructure/envelop-interceptor';
import { GenericExceptionInterceptor } from './infrastructure/generic-exception-interceptor';
import { ItemsController } from './items/items-controller';
import { ItemsService } from './items/items-service';
import { PokemonController } from './pokemon/pokemon-controller';
import { PokemonService } from './pokemon/pokemon-service';
import { TeamsController } from './teams/teams-controller';
import { TeamsService } from './teams/teams-service';
import { TypesController } from './types/types-controller';
import { TypesService } from './types/types-service';

@Module({
    imports: [
        ConfigModule.forRoot({
            validate: parseEnv,
        }),
    ],
    controllers: [AppController, TypesController, PokemonController, TeamsController, ItemsController, BackdropsController],
    providers: [
        // useFactory defers evaluation until after ConfigModule has run parseEnv,
        // so injectees see the populated safeConfig rather than the pre-init undefined.
        { provide: SAFE_CONFIG, useFactory: () => safeConfig },
        Datasource,
        TypesService,
        PokemonService,
        TeamsService,
        ItemsService,
        BackdropsService,
        // Order matters: exception interceptor runs first (outermost) so thrown
        // BaseExceptions become envelope-shaped HttpException payloads before
        // the envelop interceptor sees them as already-envelope responses.
        { provide: APP_INTERCEPTOR, useClass: GenericExceptionInterceptor },
        { provide: APP_INTERCEPTOR, useClass: EnvelopInterceptor },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
    ],
})
export class AppModule {}
