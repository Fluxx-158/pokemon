import { sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';

export type MetadataField =
    | 'last_pokeapi_sync'
    | 'last_pc_overlay_sync'
    | 'last_mega_evolutions_seed';

// Stamps the given timestamp column to NOW() on the singleton metadata row.
// Safe to call from any sync/overlay/seed script after a successful run.
// No-ops if the metadata row doesn't exist yet (run `npm run seed:metadata` first).
export async function touchMetadata(
    db: MySql2Database<Record<string, never>>,
    field: MetadataField,
): Promise<void> {
    // Field is a typed enum — sql.raw is safe (no SQL injection risk).
    await db.execute(sql.raw(`UPDATE metadata SET ${field} = NOW() WHERE id = 1`));
}
