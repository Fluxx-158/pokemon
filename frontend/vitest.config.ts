import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Vitest resolves the `@/` alias the app uses. Tests target pure libs (no DOM),
// so the default node environment is fine.
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        environment: 'node',
    },
});
