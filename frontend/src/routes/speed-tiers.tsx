import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// Eager shell, component is in speed-tiers.lazy.tsx. validateSearch lets
// /speed-tiers?teamId=10 deep-link to a specific team's ladder.
export const Route = createFileRoute('/speed-tiers')({
    validateSearch: z.object({
        teamId: z.coerce.number().int().positive().optional(),
    }),
});
