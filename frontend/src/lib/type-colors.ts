export interface TypeColor {
    bg: string;
    fg: string;
}

export const TYPE_COLORS: Record<string, TypeColor> = {
    Normal: { bg: '#A8A878', fg: '#000000' },
    Fire: { bg: '#F08030', fg: '#FFFFFF' },
    Water: { bg: '#6890F0', fg: '#FFFFFF' },
    Electric: { bg: '#F8D030', fg: '#000000' },
    Grass: { bg: '#78C850', fg: '#FFFFFF' },
    Ice: { bg: '#98D8D8', fg: '#000000' },
    Fighting: { bg: '#C03028', fg: '#FFFFFF' },
    Poison: { bg: '#A040A0', fg: '#FFFFFF' },
    Ground: { bg: '#E0C068', fg: '#000000' },
    Flying: { bg: '#A890F0', fg: '#000000' },
    Psychic: { bg: '#F85888', fg: '#FFFFFF' },
    Bug: { bg: '#A8B820', fg: '#FFFFFF' },
    Rock: { bg: '#B8A038', fg: '#FFFFFF' },
    Ghost: { bg: '#705898', fg: '#FFFFFF' },
    Dragon: { bg: '#7038F8', fg: '#FFFFFF' },
    Dark: { bg: '#705848', fg: '#FFFFFF' },
    Steel: { bg: '#B8B8D0', fg: '#000000' },
    Fairy: { bg: '#EE99AC', fg: '#000000' },
};

export function typeColor(name: string): TypeColor {
    return TYPE_COLORS[name] ?? { bg: '#888888', fg: '#FFFFFF' };
}
