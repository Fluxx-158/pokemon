// Render a Pokemon sprite from a free-text species name (e.g.
// "Mega Charizard Y" or "Charizard") by resolving against a
// pre-built lookup. Falls back to a small italic "?Name" placeholder
// when the name doesn't resolve.

import { Sprite } from '@/components/sprite';
import { findSpecies } from '@/lib/species-lookup';
import type { PokemonListItem } from '@/modules/api/endpoints';

interface Props {
    name: string;
    lookup: Map<string, PokemonListItem>;
    size?: number;
}

export function SpeciesSprite({ name, lookup, size = 24 }: Props) {
    const found = findSpecies(lookup, name);
    if (!found) {
        return <span className="text-[10px] text-muted-foreground italic" title={name}>?{name}</span>;
    }
    return (
        <Sprite
            id={found.id}
            alt={found.displayName}
            title={found.displayName}
            width={size}
            height={size}
            loading="lazy"
        />
    );
}
