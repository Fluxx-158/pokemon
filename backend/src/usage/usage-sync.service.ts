import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, sql } from 'drizzle-orm';
import { Datasource } from '../db/datasource';
import { MetadataTable } from '../db/schema/metadata';
import { SAFE_CONFIG, type SafeConfig } from '../env';
import { runUsageSync } from './usage-sync';
import { verifyUsage } from './verify-usage';

// Layered auto-refresh for championsbattledata usage (feature-plan F2 OQ4):
//   1. manual `npm run sync:usage` (the seed; lives in scripts/)
//   2. on-startup freshness gate, re-sync if data is missing or >24h stale
//   3. a daily in-app cron while the backend runs
// Layer 1's CLI and layers 2-3 here both call the same runUsageSync().

const STALE_MINUTES = 24 * 60;

@Injectable()
export class UsageSyncService implements OnModuleInit {
    private readonly logger = new Logger(UsageSyncService.name);
    private running = false;

    constructor(
        private readonly datasource: Datasource,
        @Inject(SAFE_CONFIG) private readonly config: SafeConfig,
    ) {}

    onModuleInit(): void {
        if (!this.config.usageSyncEnabled) {
            this.logger.log('Usage auto-sync DISABLED (USAGE_SYNC_ENABLED=false), offline mode; no network calls. Meta features use existing DB data only.');
            return;
        }
        // Fire-and-forget: never block app startup on a network sync.
        void this.syncIfStale();
    }

    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async dailyRefresh(): Promise<void> {
        if (!this.config.usageSyncEnabled) return; // offline mode, skip the cron
        await this.runSync('daily cron');
    }

    private async syncIfStale(): Promise<void> {
        try {
            // Compute the age entirely in the DB clock, TIMESTAMPDIFF avoids the
            // timezone skew you get parsing a MySQL `timestamp` string in JS.
            // Returns NULL when no sync has run yet.
            const rows = await this.datasource.db
                .select({
                    ageMin: sql<number | null>`TIMESTAMPDIFF(MINUTE, ${MetadataTable.lastUsageSync}, NOW())`,
                })
                .from(MetadataTable)
                .where(eq(MetadataTable.id, 1))
                .limit(1);
            const raw = rows[0]?.ageMin;
            const ageMin = raw == null ? null : Number(raw);
            if (ageMin === null || ageMin > STALE_MINUTES) {
                await this.runSync(ageMin === null ? 'startup (no data yet)' : `startup (data ${Math.round(ageMin / 60)}h stale)`);
            } else {
                this.logger.log(`Usage data is fresh (${Math.round(ageMin / 60)}h old); skipping startup sync.`);
            }
        } catch (err) {
            this.logger.error(`Startup freshness check failed: ${err instanceof Error ? err.message : err}`);
        }
    }

    private async runSync(reason: string): Promise<void> {
        if (this.running) {
            this.logger.warn(`Usage sync already running; skipping (${reason}).`);
            return;
        }
        this.running = true;
        this.logger.log(`Usage sync started (${reason})…`);
        try {
            const summary = await runUsageSync(this.datasource.db, { log: (m) => this.logger.debug(m) });
            this.logger.log(
                `Usage sync done: ${summary.inserted} rows, ${summary.formats.join('+')}, `
                + `${summary.fetchFailures.length} fetch failures, season ${summary.season ?? '?'}, source ${summary.generatedAt}.`,
            );
            // Run the same checks the CLI does, a sync can "succeed" and still
            // land bad data (upstream shape drift), and on the cron path nobody
            // is watching, so surface failures loudly in the log.
            await this.verifyAfterSync();
        } catch (err) {
            // runUsageSync aborts (without touching the table) on heavy fetch
            // failure, so a failed run leaves the last good dataset intact.
            this.logger.error(`Usage sync failed: ${err instanceof Error ? err.message : err}`);
        } finally {
            this.running = false;
        }
    }

    // Verification never throws, a failed check means "don't trust the meta
    // surfaces", not "crash the app". The sync's own no-wipe guard already
    // protects the last good dataset.
    private async verifyAfterSync(): Promise<void> {
        try {
            const { checks, passed, failed, stats } = await verifyUsage(this.datasource.db);
            if (failed === 0) {
                this.logger.log(`Usage verification passed (${passed}/${checks.length}): ${stats.distinctPokemon} pokemon, season ${stats.season ?? '?'}.`);
                return;
            }
            this.logger.error(`Usage verification FAILED, ${failed}/${checks.length} checks failed. Meta surfaces may be wrong:`);
            for (const c of checks.filter((x) => !x.ok)) {
                this.logger.error(`  ✗ ${c.label}${c.detail ? `: ${c.detail}` : ''}`);
            }
        } catch (err) {
            this.logger.error(`Usage verification could not run: ${err instanceof Error ? err.message : err}`);
        }
    }
}
