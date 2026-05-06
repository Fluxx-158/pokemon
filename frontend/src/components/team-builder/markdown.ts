// Shared types + markdown serialiser for the structured team-builder form.
// Both the create (/teams/new) and edit (/teams/$id/edit) routes use these.

import type { MemberFormState } from '@/components/team-builder/member-card';

export interface NotesState {
    leadPair: string;
    backPair: string;
    megaHolder: string;
    other: string;
}

export const EMPTY_NOTES: NotesState = {
    leadPair: '',
    backPair: '',
    megaHolder: '',
    other: '',
};

export interface BuildMarkdownInput {
    teamName: string;
    members: MemberFormState[];
    notes: NotesState;
    pokemonList: ReadonlyArray<{ id: number; displayName: string; type1: string; type2: string | null }>;
    itemList: ReadonlyArray<{ id: number; displayName: string }>;
    details: ReadonlyArray<{
        abilities: Array<{ id: number; displayName: string }>;
        moves: Array<{ id: number; displayName: string }>;
    } | null>;
}

export function buildMarkdown(input: BuildMarkdownInput): string {
    const lines: string[] = [];
    lines.push(`# Team name: ${input.teamName}`);
    lines.push('');

    input.members.forEach((m, i) => {
        const slot = i + 1;
        lines.push(`## Pokemon ${slot}`);

        const poke = input.pokemonList.find((p) => p.id === m.pokemonId) ?? null;
        const detail = input.details[i];
        const ability = detail?.abilities.find((a) => a.id === m.abilityId) ?? null;
        const item = input.itemList.find((it) => it.id === m.itemId) ?? null;
        const movesByName = (m.moveIds.filter((id): id is number => id !== null))
            .map((id) => detail?.moves.find((mv) => mv.id === id)?.displayName ?? '')
            .filter((s) => s.length > 0);

        const typeStr = poke
            ? poke.type2 ? `${poke.type1}/${poke.type2}` : poke.type1
            : '';

        lines.push(`- **Species:** ${poke?.displayName ?? ''}`);
        lines.push(`- **Type:** ${typeStr}`);
        lines.push(`- **Ability:** ${ability?.displayName ?? ''}`);
        lines.push(`- **Nature:** ${m.nature}`);
        lines.push(`- **Held Item:** ${item?.displayName ?? ''}`);
        lines.push(`- **Moves:** ${movesByName.join(' / ')}`);
        lines.push(`- **Stats (HP/Atk/Def/SpA/SpD/Spe):** `);
        const e = m.evs;
        lines.push(`- **EVs (HP/Atk/Def/SpA/SpD/Spe):** ${e.hp} / ${e.atk} / ${e.def} / ${e.spa} / ${e.spd} / ${e.spe}`);
        lines.push('');
    });

    lines.push('## Notes');
    if (input.notes.megaHolder) lines.push(`- Mega Stone holder: ${input.notes.megaHolder}`);
    if (input.notes.leadPair) lines.push(`- Standard lead pair: ${input.notes.leadPair}`);
    if (input.notes.backPair) lines.push(`- Standard back pair: ${input.notes.backPair}`);
    if (input.notes.other) lines.push(`- Anything else worth flagging: ${input.notes.other}`);
    lines.push('');

    return lines.join('\n');
}
