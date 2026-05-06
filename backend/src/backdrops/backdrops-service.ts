// User-uploaded backdrop assets — image or video files used by the
// frontend's backdrop picker. Stored as plain files in
// frontend/public/backdrops/ so Vite serves them at /backdrops/<name>
// directly (no fastify-static handler on the backend side).

import {
    existsSync,
    mkdirSync,
    readdirSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { BusinessException } from '../infrastructure/exceptions';

// Project-root → frontend/public/backdrops/. Same up-three pattern as
// the Teams folder lookup in teams-service: works in both dev (src/)
// and prod (dist/) since both sit at the same depth. resolve() to a
// canonical absolute path so the path-escape check below is reliable.
const BACKDROPS_ROOT = resolve(join(__dirname, '..', '..', '..', 'frontend', 'public', 'backdrops'));

// Belt-and-suspenders: confirm the resolved target actually lives inside
// BACKDROPS_ROOT. Sanitization already strips path-traversal characters,
// but this defends against future symlinks or unexpected normalisation.
function assertInsideRoot(filename: string): string {
    const target = resolve(join(BACKDROPS_ROOT, filename));
    if (target !== join(BACKDROPS_ROOT, filename) || !target.startsWith(BACKDROPS_ROOT)) {
        throw new BusinessException({
            message: 'Resolved path escapes backdrops folder',
            code: 'BACKDROP_INVALID_PATH',
            httpStatus: 400,
        });
    }
    return target;
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov']);
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export interface BackdropEntry {
    name: string;             // filename on disk
    kind: 'image' | 'video';
    mimeType: string;
    size: number;
    url: string;              // /backdrops/<name>, served by Vite
    createdAt: number;        // mtime ms
}

function ensureDir(): void {
    if (!existsSync(BACKDROPS_ROOT)) {
        mkdirSync(BACKDROPS_ROOT, { recursive: true });
    }
}

function kindForExt(ext: string): 'image' | 'video' {
    return ext === '.mp4' || ext === '.webm' || ext === '.mov' ? 'video' : 'image';
}

function mimeForExt(ext: string): string {
    switch (ext) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png':  return 'image/png';
        case '.gif':  return 'image/gif';
        case '.webp': return 'image/webp';
        case '.mp4':  return 'video/mp4';
        case '.webm': return 'video/webm';
        case '.mov':  return 'video/quicktime';
        default:      return 'application/octet-stream';
    }
}

// Strip path separators + collapse anything risky. Keeps alphanumerics,
// dots, dashes, underscores, spaces. Replaces everything else with -.
// Returns the sanitized filename (no path components).
function sanitizeFilename(raw: string): string {
    // Drop any directory portion the client tried to send.
    const justName = raw.split(/[/\\]/).pop() ?? raw;
    return justName
        .replace(/[^A-Za-z0-9._\- ]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
        .slice(0, 120);  // soft cap on length
}

// On filename collision, append -2, -3, ... before the extension.
function uniqueName(name: string): string {
    if (!existsSync(join(BACKDROPS_ROOT, name))) return name;
    const ext = extname(name);
    const base = name.slice(0, -ext.length || undefined);
    let i = 2;
    while (existsSync(join(BACKDROPS_ROOT, `${base}-${i}${ext}`))) i++;
    return `${base}-${i}${ext}`;
}

function entryFor(name: string): BackdropEntry {
    const fullPath = join(BACKDROPS_ROOT, name);
    const stat = statSync(fullPath);
    const ext = extname(name).toLowerCase();
    return {
        name,
        kind: kindForExt(ext),
        mimeType: mimeForExt(ext),
        size: stat.size,
        url: `/backdrops/${name}`,
        createdAt: stat.mtimeMs,
    };
}

@Injectable()
export class BackdropsService {
    list(): BackdropEntry[] {
        ensureDir();
        const files = readdirSync(BACKDROPS_ROOT).filter((f) => {
            if (f.startsWith('.')) return false;
            return ALLOWED_EXT.has(extname(f).toLowerCase());
        });
        const entries = files.map(entryFor);
        // Newest first.
        entries.sort((a, b) => b.createdAt - a.createdAt);
        return entries;
    }

    create(input: { filename: string; mimeType: string; dataBase64: string }): BackdropEntry {
        ensureDir();
        const cleaned = sanitizeFilename(input.filename);
        if (!cleaned) {
            throw new BusinessException({
                message: 'Filename is required',
                code: 'BACKDROP_INVALID_NAME',
                httpStatus: 400,
            });
        }
        const ext = extname(cleaned).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
            throw new BusinessException({
                message: `Unsupported file type: ${ext || '(none)'}. Allowed: ${[...ALLOWED_EXT].join(', ')}`,
                code: 'BACKDROP_BAD_EXT',
                httpStatus: 400,
            });
        }
        if (!/^(image|video)\//.test(input.mimeType)) {
            throw new BusinessException({
                message: `Unsupported MIME type: ${input.mimeType}`,
                code: 'BACKDROP_BAD_MIME',
                httpStatus: 400,
            });
        }

        // Buffer.from(s, 'base64') silently drops invalid chars rather than
        // throwing; an empty/garbage payload manifests as an empty buffer,
        // caught by the size check just below.
        const buffer = Buffer.from(input.dataBase64, 'base64');
        if (buffer.length === 0) {
            throw new BusinessException({
                message: 'Empty file',
                code: 'BACKDROP_EMPTY',
                httpStatus: 400,
            });
        }
        if (buffer.length > MAX_BYTES) {
            throw new BusinessException({
                message: `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)} MB. Max ${MAX_BYTES / 1024 / 1024} MB.`,
                code: 'BACKDROP_TOO_LARGE',
                httpStatus: 413,
            });
        }

        const finalName = uniqueName(cleaned);
        const target = assertInsideRoot(finalName);
        writeFileSync(target, buffer);
        return entryFor(finalName);
    }

    delete(name: string): void {
        const cleaned = sanitizeFilename(name);
        if (!cleaned) {
            throw new BusinessException({
                message: 'Filename is required',
                code: 'BACKDROP_INVALID_NAME',
                httpStatus: 400,
            });
        }
        const target = assertInsideRoot(cleaned);
        if (!existsSync(target)) {
            throw new BusinessException({
                message: `Backdrop not found: ${cleaned}`,
                code: 'BACKDROP_NOT_FOUND',
                httpStatus: 404,
            });
        }
        unlinkSync(target);
    }
}
