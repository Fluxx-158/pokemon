import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// Eager shell — searchMatchups + the search UI live in matchups.lazy.tsx.
// validateSearch lets us deep-link into /matchups?q=foo from anywhere
// (e.g. the search bar on /teams).
export const Route = createFileRoute('/matchups')({
    validateSearch: z.object({
        q: z.string().optional(),
        teamId: z.coerce.number().int().positive().optional(),
    }),
});
