import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/pokemon')({
    component: PokemonLayout,
});

function PokemonLayout() {
    return <Outlet />;
}
