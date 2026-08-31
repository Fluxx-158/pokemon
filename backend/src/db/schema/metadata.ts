import { mysqlTable, int, varchar, timestamp } from 'drizzle-orm/mysql-core';

// Singleton table, id is always 1. Stores last-run timestamps for each
// pipeline stage and the current PC patch version. Add new columns here
// as we add new sync/overlay sources.
export const MetadataTable = mysqlTable('metadata', {
    id: int('id').primaryKey(),
    lastPokeapiSync: timestamp('last_pokeapi_sync'),
    lastPcOverlaySync: timestamp('last_pc_overlay_sync'),
    lastMegaEvolutionsSeed: timestamp('last_mega_evolutions_seed'),
    // When we last ingested championsbattledata usage, plus the source's own
    // `generatedAt` so the freshness gate can skip re-syncing unchanged data.
    lastUsageSync: timestamp('last_usage_sync'),
    usageSourceGeneratedAt: varchar('usage_source_generated_at', { length: 40 }),
    // Ranked-battle SEASON the usage data came from (e.g. "M4"). Distinct from
    // the regulation (M-B), seasons roll monthly inside a regulation, and the
    // API only exposes the season, so UI labels read from this.
    usageSourceSeason: varchar('usage_source_season', { length: 16 }),
    pcPatchVersion: varchar('pc_patch_version', { length: 32 }),
});
