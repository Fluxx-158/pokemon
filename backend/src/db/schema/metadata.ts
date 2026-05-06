import { mysqlTable, int, varchar, timestamp } from 'drizzle-orm/mysql-core';

// Singleton table — id is always 1. Stores last-run timestamps for each
// pipeline stage and the current PC patch version. Add new columns here
// as we add new sync/overlay sources.
export const MetadataTable = mysqlTable('metadata', {
    id: int('id').primaryKey(),
    lastPokeapiSync: timestamp('last_pokeapi_sync'),
    lastPcOverlaySync: timestamp('last_pc_overlay_sync'),
    lastMegaEvolutionsSeed: timestamp('last_mega_evolutions_seed'),
    pcPatchVersion: varchar('pc_patch_version', { length: 32 }),
});
