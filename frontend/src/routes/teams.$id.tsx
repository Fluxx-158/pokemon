import { createFileRoute, Outlet } from '@tanstack/react-router';

// Layout wrapper so /teams/$id and /teams/$id/edit can coexist as siblings
// under TanStack Router's flat-file convention.
export const Route = createFileRoute('/teams/$id')({
    component: TeamIdLayout,
    parseParams: (params) => ({ id: Number(params.id) }),
});

function TeamIdLayout() {
    return <Outlet />;
}
