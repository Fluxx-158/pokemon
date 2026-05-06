// Tolerant species-name lookup. Mirrors the backend's resolver in
// team-parser.ts so client-side renderers (matchup row sprites, opponent
// leads, etc.) can resolve abbreviated or styled names like "Mega
// Charizard Y" or "Charizard" against the same canonical form.

import type { PokemonListItem } from '@/modules/api/endpoints';

// Lowercase + strip non-alphanumerics. "Mega-Charizard Y" → "megacharizardy".
export function normalizeSpeciesKey(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build a name → PokemonListItem map keyed by the normalized full
// displayName plus the first-word fallback (so a bare "Meowstic" resolves
// to "Meowstic Male"). PC-available entries are preferred when two
// pokemon collide on the same key.
export function buildPokemonLookup(list: PokemonListItem[] | undefined): Map<string, PokemonListItem> {
    const map = new Map<string, PokemonListItem>();
    if (!list) return map;
    const sorted = [...list].sort((a, b) => Number(b.pcAvailable) - Number(a.pcAvailable));
    for (const p of sorted) {
        const full = normalizeSpeciesKey(p.displayName);
        if (!map.has(full)) map.set(full, p);
        const firstWord = normalizeSpeciesKey(p.displayName.split(/\s+/)[0]);
        if (firstWord && !map.has(firstWord)) map.set(firstWord, p);
    }
    return map;
}

// Convenience: lookup a name against a pre-built map.
export function findSpecies(
    lookup: Map<string, PokemonListItem>,
    name: string,
): PokemonListItem | undefined {
    return lookup.get(normalizeSpeciesKey(name));
}
