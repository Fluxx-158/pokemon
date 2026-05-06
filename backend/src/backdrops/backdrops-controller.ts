import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BackdropsService } from './backdrops-service';

// 140 MB cap on the base64 string — about 100 MB of decoded binary,
// matching the per-file size cap in the service.
const MAX_BASE64_LEN = 140 * 1024 * 1024;

const UploadBackdropSchema = z.object({
    filename: z.string().min(1).max(200),
    mimeType: z.string().regex(/^(image|video)\//, 'Must be image/* or video/*'),
    dataBase64: z.string().min(1).max(MAX_BASE64_LEN),
});
class UploadBackdropDto extends createZodDto(UploadBackdropSchema) {}

@Controller('backdrops')
export class BackdropsController {
    constructor(private readonly service: BackdropsService) {}

    @Get()
    list() {
        return this.service.list();
    }

    @Post()
    @HttpCode(201)
    upload(@Body() body: UploadBackdropDto) {
        return this.service.create({
            filename: body.filename,
            mimeType: body.mimeType,
            dataBase64: body.dataBase64,
        });
    }

    @Delete(':name')
    @HttpCode(204)
    remove(@Param('name') name: string): void {
        this.service.delete(name);
    }
}
