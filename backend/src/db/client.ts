import 'dotenv/config';

export interface DbConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export function loadConfig(): DbConfig {
    const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Missing required env var: ${key}. Check backend/.env`);
        }
    }
    return {
        host: process.env.DB_HOST!,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
    };
}
