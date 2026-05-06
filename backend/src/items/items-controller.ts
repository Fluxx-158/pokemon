import { Controller, Get, Query } from '@nestjs/common';
import { parseBoolQuery } from '../infrastructure/query-utils';
import { ItemsService } from './items-service';

@Controller()
export class ItemsController {
    constructor(private readonly service: ItemsService) {}

    @Get('items')
    async findAll(
        @Query('holdable') holdable?: string,
        @Query('pcOnly') pcOnly?: string,
    ) {
        return this.service.findAll({
            holdable: parseBoolQuery(holdable),
            pcOnly: parseBoolQuery(pcOnly),
        });
    }
}
