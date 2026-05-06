// Shared query-string coercions. Keep these tiny — anything past truthy/intish
// belongs in a per-route zod schema, not a generic helper.

// `?flag=true` and `?flag=1` count as true, everything else (including
// missing) as false. Mirrors how the URL-bar UX has been used since v1.
export function parseBoolQuery(raw: string | undefined): boolean {
    return raw === 'true' || raw === '1';
}
