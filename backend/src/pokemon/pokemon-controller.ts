import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { parseBoolQuery } from '../infrastructure/query-utils';
import { PokemonService } from './pokemon-service';

@Controller()
export class PokemonController {

    constructor(private readonly service: PokemonService) {}

    @Get('pokemon')
    async findAll(@Query('pcOnly') pcOnly?: string) {
        return this.service.findAll({ pcOnly: parseBoolQuery(pcOnly) });
    }

    @Get('pokemon/:id')
    async findById(@Param('id', ParseIntPipe) id: number) {
        return this.service.findById(id);
    }
}
