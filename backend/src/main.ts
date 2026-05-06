import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
    const adapter = new FastifyAdapter({ logger: true });

    // Per-route body limit bump for the backdrop upload, which carries
    // base64 of up to ~100 MB binary (140 MB string). Every other route
    // stays on Fastify's 1 MB default so a giant body to (e.g.) /teams
    // can't pin memory. Hook fires at route registration; must run before
    // NestFactory.create wires up the controllers.
    const BACKDROP_BODY_LIMIT = 150 * 1024 * 1024;
    adapter.getInstance().addHook('onRoute', (routeOptions) => {
        if (routeOptions.method === 'POST' && routeOptions.url === '/backdrops') {
            routeOptions.bodyLimit = BACKDROP_BODY_LIMIT;
        }
    });
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

    // Restrict to the Vite dev server. Wide-open CORS would let any site
    // the user visits make requests to localhost:3000 in the browser.
    app.enableCors({ origin: 'http://localhost:5173' });
    app.enableShutdownHooks();

    // Static-serve mirrored sprites (populated by `npm run mirror:sprites`).
    // The sprites/ folder lives outside dist/, so resolve relative to the project root.
    //
    // Type cast: @fastify/static@7 is typed against Fastify 5 but
    // @nestjs/platform-fastify@10 still exposes Fastify 4's register signature,
    // so the plugin type doesn't structurally match. Runtime is fine —
    // fastify@5 is the installed peer. Routing through `unknown` makes the
    // cast intentional (instead of `as never`, which silently swallows any
    // future signature change). When platform-fastify upgrades to v11
    // (Fastify-5-typed), drop the cast — TS will then accept the plugin
    // directly and flag the cast as redundant.
    type AppRegister = Parameters<typeof app.register>[0];
    await app.register(fastifyStatic as unknown as AppRegister, {
        root: join(__dirname, '..', 'public', 'sprites'),
        prefix: '/sprites/',
        decorateReply: false,
    });

    const port = Number(process.env.PORT) || 3000;
    // Bind to loopback only — keeps the API off the LAN so other devices on
    // the same network can't reach it.
    await app.listen({ port, host: '127.0.0.1' });
    console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
});
