import { z } from 'zod';

const notEmptyString = z.string().min(1);

const rawEnvSchema = z.object({
    DB_HOST: notEmptyString,
    DB_PORT: z.coerce.number().int(),
    DB_USER: notEmptyString,
    DB_PASSWORD: notEmptyString,
    DB_NAME: notEmptyString,
    PORT: z.coerce.number().int().default(3000),
});

export interface SafeConfig {
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbPassword: string;
    dbName: string;
    port: number;
}

export const SAFE_CONFIG = Symbol('SAFE_CONFIG');

// Mutated by parseEnv() during ConfigModule init. Read via the SAFE_CONFIG
// provider (a useFactory closure) so injectees see the post-init value, not
// the pre-init undefined snapshot.
export let safeConfig: SafeConfig;

export function parseEnv(values: Record<string, unknown>): SafeConfig {
    const raw = rawEnvSchema.parse(values);
    safeConfig = {
        dbHost: raw.DB_HOST,
        dbPort: raw.DB_PORT,
        dbUser: raw.DB_USER,
        dbPassword: raw.DB_PASSWORD,
        dbName: raw.DB_NAME,
        port: raw.PORT,
    };
    return safeConfig;
}
