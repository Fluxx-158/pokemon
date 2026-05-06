import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BusinessException } from '../infrastructure/exceptions';
import { TeamsService } from './teams-service';

// `?teamId=foo` should 400, not silently fall back to "all teams". Coerce
// from the URL string and require a positive int when present.
const MatchupSearchQuerySchema = z.object({
    q: z.string().optional(),
    teamId: z
        .string()
        .optional()
        .refine((v) => v === undefined || /^\d+$/.test(v), {
            message: 'teamId must be a positive integer',
        })
        .transform((v) => (v === undefined ? undefined : Number(v))),
});

const CreateTeamSchema = z.object({
    sourceFolder: z.string().min(1, 'sourceFolder is required'),
    markdown: z.string().min(1, 'markdown is required'),
});
class CreateTeamDto extends createZodDto(CreateTeamSchema) {}

const UpdateTeamSchema = z.object({
    markdown: z.string().min(1, 'markdown is required'),
});
class UpdateTeamDto extends createZodDto(UpdateTeamSchema) {}

// Strategy can legitimately be empty (clearing a stale playbook), so the
// schema doesn't require a non-empty string here.
const UpdateStrategySchema = z.object({
    markdown: z.string(),
});
class UpdateStrategyDto extends createZodDto(UpdateStrategySchema) {}

// PATCH body — both fields optional; pass at least one.
const RenameTeamSchema = z.object({
    name: z.string().min(1).optional(),
    sourceFolder: z.string().min(1).optional(),
}).refine(
    (v) => v.name !== undefined || v.sourceFolder !== undefined,
    { message: 'Provide at least one of name or sourceFolder' },
);
class RenameTeamDto extends createZodDto(RenameTeamSchema) {}

const CreateMatchupSchema = z.object({
    slug: z.string().min(1, 'slug is required'),
    markdown: z.string().min(1, 'markdown is required'),
});
class CreateMatchupDto extends createZodDto(CreateMatchupSchema) {}

const UpdateMatchupSchema = z.object({
    markdown: z.string().min(1, 'markdown is required'),
});
class UpdateMatchupDto extends createZodDto(UpdateMatchupSchema) {}

@Controller()
export class TeamsController {
    constructor(private readonly service: TeamsService) {}

    @Get('teams')
    async findAll() {
        return this.service.findAll();
    }

    // Cross-team matchup search. Walks every team's matchups directory once
    // and returns a flat list with team context. Optional `q` param filters
    // by case-insensitive substring match across title / slug / frontmatter
    // values / body, and includes a body excerpt when the match was in the body.
    @Get('matchups')
    async searchMatchups(
        @Query() rawQuery: Record<string, string | undefined>,
    ) {
        // Validate the query object so a non-numeric `teamId` returns 400
        // rather than getting silently dropped.
        const parsed = MatchupSearchQuerySchema.safeParse(rawQuery);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new BusinessException({
                message: issue.message,
                code: 'INVALID_QUERY',
                httpStatus: 400,
            });
        }
        return this.service.searchMatchups(parsed.data.q, parsed.data.teamId);
    }

    @Get('teams/:id')
    async findById(@Param('id', ParseIntPipe) id: number) {
        return this.service.findById(id);
    }

    @Post('teams')
    @HttpCode(201)
    async create(@Body() body: CreateTeamDto) {
        return this.service.create({
            sourceFolder: body.sourceFolder,
            markdown: body.markdown,
        });
    }

    @Put('teams/:id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateTeamDto,
    ) {
        return this.service.update(id, { markdown: body.markdown });
    }

    @Delete('teams/:id')
    @HttpCode(204)
    async remove(@Param('id', ParseIntPipe) id: number) {
        await this.service.delete(id);
    }

    @Put('teams/:id/strategy')
    async updateStrategy(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateStrategyDto,
    ) {
        return this.service.updateStrategy(id, { markdown: body.markdown });
    }

    @Patch('teams/:id')
    async rename(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: RenameTeamDto,
    ) {
        return this.service.rename(id, {
            name: body.name,
            sourceFolder: body.sourceFolder,
        });
    }

    @Get('teams/:id/matchups/:slug')
    async getMatchup(
        @Param('id', ParseIntPipe) id: number,
        @Param('slug') slug: string,
    ) {
        return this.service.getMatchup(id, slug);
    }

    @Post('teams/:id/matchups')
    @HttpCode(201)
    async createMatchup(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: CreateMatchupDto,
    ) {
        return this.service.createMatchup(id, {
            slug: body.slug,
            markdown: body.markdown,
        });
    }

    @Put('teams/:id/matchups/:slug')
    async updateMatchup(
        @Param('id', ParseIntPipe) id: number,
        @Param('slug') slug: string,
        @Body() body: UpdateMatchupDto,
    ) {
        return this.service.updateMatchup(id, slug, { markdown: body.markdown });
    }

    @Delete('teams/:id/matchups/:slug')
    @HttpCode(204)
    async deleteMatchup(
        @Param('id', ParseIntPipe) id: number,
        @Param('slug') slug: string,
    ) {
        await this.service.deleteMatchup(id, slug);
    }
}
