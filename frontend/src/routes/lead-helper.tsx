import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// Eager shell — component is in lead-helper.lazy.tsx. validateSearch lets
// /lead-helper?teamId=10 deep-link to a specific team's helper.
export const Route = createFileRoute('/lead-helper')({
    validateSearch: z.object({
        teamId: z.coerce.number().int().positive().optional(),
    }),
});
