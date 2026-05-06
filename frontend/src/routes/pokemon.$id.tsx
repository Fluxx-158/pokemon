import { createFileRoute } from '@tanstack/react-router';

// Eager route shell — params are parsed here so the router can match
// instantly. The component lives in pokemon.$id.lazy.tsx and only loads
// when the user navigates to a pokemon detail page.
export const Route = createFileRoute('/pokemon/$id')({
    parseParams: (params) => ({ id: Number(params.id) }),
});
