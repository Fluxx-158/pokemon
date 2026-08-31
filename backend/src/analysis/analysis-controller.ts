import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AnalysisService } from './analysis-service';

type UsageFormat = 'doubles' | 'singles';
function parseFormat(v: string | undefined): UsageFormat {
    if (v === 'singles') return 'singles';
    if (v === 'doubles' || v === undefined) return 'doubles';
    throw new BadRequestException('format must be "doubles" or "singles"');
}

const PartnerSchema = z.object({
    format: z.enum(['doubles', 'singles']),
    members: z
        .array(z.object({
            pokemonId: z.number().int().positive(),
            ability: z.string().nullable().optional().transform((v) => v ?? null),
            moveTypes: z.array(z.string()).optional().transform((v) => v ?? []),
        }))
        .min(1, 'Provide at least one team member'),
});
class PartnerDto extends createZodDto(PartnerSchema) {}

@Controller('analysis')
export class AnalysisController {
    constructor(private readonly service: AnalysisService) {}

    @Post('partners')
    async partners(@Body() body: PartnerDto) {
        return this.service.suggestPartners({
            format: body.format,
            members: body.members.map((m) => ({
                pokemonId: m.pokemonId,
                ability: m.ability ?? null,
                moveTypes: m.moveTypes ?? [],
            })),
        });
    }

    // Top meta Pokemon for the format (popularity-ranked) with their offensive
    // types, the client builds the threaten/safe matrix from this.
    @Get('meta')
    async meta(@Query('format') format?: string, @Query('limit') limit?: string) {
        const n = limit ? Math.min(60, Math.max(5, Number(limit) || 30)) : 30;
        return this.service.getMeta(parseFormat(format), n);
    }

    @Get('speed-tiers')
    async speedTiers(@Query('format') format?: string, @Query('limit') limit?: string) {
        const n = limit ? Math.min(80, Math.max(10, Number(limit) || 40)) : 40;
        return this.service.getSpeedTiers(parseFormat(format), n);
    }

    @Get('meta-target')
    async metaTarget(@Query('format') format: string | undefined, @Query('pokemonId') pokemonId?: string) {
        const id = Number(pokemonId);
        if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('pokemonId must be a positive integer');
        const target = await this.service.getMetaTarget(parseFormat(format), id);
        if (!target) throw new BadRequestException('pokemon not found');
        return target;
    }
}
