import { createFileRoute, Outlet } from '@tanstack/react-router';
import { z } from 'zod';

// Layout for /teams/new and /teams/new/markdown — both routes are siblings
// under the synthetic `/teams/new` parent that TanStack Router creates from
// the dotted file naming.
//
// validateSearch lives here on the eager layout (lazy children can't declare
// route config) so the structured form's index route can read `?from=:id` to
// duplicate an existing team.
export const Route = createFileRoute('/teams/new')({
    component: NewTeamLayout,
    validateSearch: z.object({
        from: z.coerce.number().int().positive().optional(),
    }),
});

function NewTeamLayout() {
    return <Outlet />;
}
