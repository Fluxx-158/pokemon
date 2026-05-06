import { Controller, Get } from '@nestjs/common';
import { TypesService } from './types-service';

@Controller()
export class TypesController {

    constructor(private readonly service: TypesService) {}

    @Get('types')
    async findAll() {
        return this.service.findAll();
    }

    @Get('types/chart')
    async getChart() {
        return this.service.getChart();
    }
}
