import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/db/client';

const SPRITES_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const PUBLIC_DIR = join(__dirname, '..', 'public', 'sprites', 'pokemon');
const FETCH_CONCURRENCY = 8;

interface MirrorVariant {
    label: string;
    remotePath: (id: number) => string;
    localPath: (id: number) => string;
}

const VARIANTS: MirrorVariant[] = [
    {
        label: 'default',
        remotePath: (id) => `${SPRITES_BASE}/${id}.png`,
        localPath: (id) => join(PUBLIC_DIR, `${id}.png`),
    },
    {
        label: 'official',
        remotePath: (id) => `${SPRITES_BASE}/other/official-artwork/${id}.png`,
        localPath: (id) => join(PUBLIC_DIR, 'official', `${id}.png`),
    },
];

async function fileExists(path: string): Promise<boolean> {
    try {
        const s = await stat(path);
        return s.isFile() && s.size > 0;
    } catch {
        return false;
    }
}

interface DownloadOutcome {
    status: 'skipped' | 'downloaded' | 'missing' | 'error';
    error?: string;
}

async function downloadOne(url: string, dest: string, maxRetries = 2): Promise<DownloadOutcome> {
    if (await fileExists(dest)) return { status: 'skipped' };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url);
            if (res.status === 404) return { status: 'missing' };
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

            const buf = Buffer.from(await res.arrayBuffer());
            await mkdir(dirname(dest), { recursive: true });
            await writeFile(dest, buf);
            return { status: 'downloaded' };
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
            }
        }
    }
    return { status: 'error', error: lastErr instanceof Error ? lastErr.message : String(lastErr) };
}

interface VariantStats {
    downloaded: number;
    skipped: number;
    missing: number;
    errors: Array<{ id: number; error: string }>;
}

async function mirrorVariant(variant: MirrorVariant, ids: number[]): Promise<VariantStats> {
    const stats: VariantStats = { downloaded: 0, skipped: 0, missing: 0, errors: [] };

    for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
        const batch = ids.slice(i, i + FETCH_CONCURRENCY);
        const outcomes = await Promise.all(
            batch.map((id) => downloadOne(variant.remotePath(id), variant.localPath(id))),
        );
        for (let j = 0; j < outcomes.length; j++) {
            const o = outcomes[j];
            if (o.status === 'downloaded') stats.downloaded++;
            else if (o.status === 'skipped') stats.skipped++;
            else if (o.status === 'missing') stats.missing++;
            else if (o.status === 'error') stats.errors.push({ id: batch[j], error: o.error ?? 'unknown' });
        }
        const done = Math.min(i + FETCH_CONCURRENCY, ids.length);
        process.stdout.write(`\r  ${variant.label}: ${done}/${ids.length}`);
    }
    process.stdout.write('\n');
    return stats;
}

async function main() {
    const config = loadConfig();
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
    });

    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM pokemon ORDER BY id');
    const ids = rows.map((r) => r.id as number);
    await conn.end();

    console.log(`Mirroring sprites for ${ids.length} pokemon to ${PUBLIC_DIR}`);

    for (const variant of VARIANTS) {
        const s = await mirrorVariant(variant, ids);
        console.log(
            `  ${variant.label}: ${s.downloaded} downloaded, ${s.skipped} skipped, ${s.missing} missing (404), ${s.errors.length} errors`,
        );
        if (s.errors.length > 0) {
            for (const e of s.errors.slice(0, 10)) {
                console.log(`    error id=${e.id}: ${e.error}`);
            }
            if (s.errors.length > 10) console.log(`    ... and ${s.errors.length - 10} more`);
        }
    }

    console.log('Done.');
}

main().catch((err) => {
    console.error('Mirror failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
