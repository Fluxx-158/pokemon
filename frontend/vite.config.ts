import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
    base: '',
    plugins: [
        tsconfigPaths(),
        TanStackRouterVite(),
        react(),
    ],
    build: {
        // Pull a few heavy libraries into their own named chunks so they cache
        // independently of app code AND so route-level lazy splitting only
        // pulls them in for routes that actually import them.
        //   recharts          ~150KB raw — only the pokemon detail uses it
        //   react-markdown +  ~80KB raw  — only the team strategy view uses
        //     remark-gfm                   markdown rendering
        //   cmdk              ~30KB       — only the team builder forms
        //   radix             grows with each shadcn primitive we add
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        if (id.includes('/recharts/') || id.includes('victory-vendor')) {
                            return 'vendor-recharts';
                        }
                        if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/micromark') || id.includes('/mdast-') || id.includes('/unified/') || id.includes('/unist-')) {
                            return 'vendor-markdown';
                        }
                        if (id.includes('/cmdk/')) {
                            return 'vendor-cmdk';
                        }
                        if (id.includes('/@radix-ui/')) {
                            return 'vendor-radix';
                        }
                        // Letting Vite auto-handle @tanstack/* — splitting it
                        // out as a manual chunk produced a circular-chunk
                        // warning with vendor-recharts via shared utilities.
                    }
                    return undefined;
                },
            },
        },
    },
});
