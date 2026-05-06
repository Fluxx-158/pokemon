import { EMPTY_MEMBER, type MemberFormState } from '@/components/team-builder/member-card';
import { EMPTY_NOTES, type NotesState } from '@/components/team-builder/markdown';
import type { TeamDetail } from '@/modules/api/endpoints';

export function emptyMembers(): MemberFormState[] {
    return Array.from({ length: 6 }, () => ({ ...EMPTY_MEMBER, evs: { ...EMPTY_MEMBER.evs } }));
}

export function membersFromDetail(team: TeamDetail): MemberFormState[] {
    const out = emptyMembers();
    for (const m of team.members) {
        if (m.slot < 1 || m.slot > 6) continue;
        const sortedMoves = [...m.moves].sort((a, b) => a.slot - b.slot);
        const moveIds: [number | null, number | null, number | null, number | null] = [null, null, null, null];
        sortedMoves.slice(0, 4).forEach((mv, i) => {
            moveIds[i] = mv.id;
        });
        out[m.slot - 1] = {
            pokemonId: m.pokemon.id,
            abilityId: m.ability.id,
            itemId: m.item?.id ?? null,
            nature: m.nature,
            moveIds,
            evs: { ...m.evs },
        };
    }
    return out;
}

export function notesFromDetail(team: TeamDetail): NotesState {
    const n = team.notes;
    if (!n) return EMPTY_NOTES;
    return {
        leadPair: n.lead_pair ?? '',
        backPair: n.back_pair ?? '',
        megaHolder: n.mega_holder ?? '',
        // The notes parser collects unrecognised bullets into `other` as
        // "Label: value" strings. We flatten back to a single Input field —
        // multi-line richness is preserved by editing team.md on disk if the
        // user ever needs more than one line here.
        other: (n.other ?? []).join(' · '),
    };
}
