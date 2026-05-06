// Shared form body for the create + edit team flows.
//
// Owns: members + notes + openSlots state, the data queries (pokemon list,
// PC-holdable items, per-slot pokemon detail), validation, and the form
// markup itself.
//
// Mode-specific concerns stay in the routes:
//   - Folder name: editable input (create) vs read-only (edit) — rendered
//     by the route via the `folderInput` prop.
//   - Initial state: empty for fresh create, computed from the source team
//     for duplicate, computed from the loaded team for edit. Captured at
//     mount via useState — pass `key` to remount on a different source.
//   - Save: createTeam / updateTeam — the route wires its own mutation and
//     passes `onSave(markdown)` to receive the built markdown payload.
//   - Page chrome (h1, back link): rendered by the route, OUTSIDE this form.

import { useMemo, useState, type ReactNode } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
    getItems,
    getPokemonDetail,
    getPokemonList,
} from '@/modules/api/endpoints';
import { ErrorBanner } from '@/components/error-banner';
import { evTotal, EV_TOTAL_CAP } from '@/components/pickers/ev-inputs';
import { MemberCard, type MemberFormState } from '@/components/team-builder/member-card';
import {
    buildMarkdown,
    type NotesState,
} from '@/components/team-builder/markdown';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
    initialMembers: MemberFormState[];
    initialNotes: NotesState;
    /** Becomes the `# Team name:` line in the rendered markdown. */
    teamName: string;
    /** Editable input for create, read-only for edit. Includes any inline
     *  error/help text. */
    folderInput: ReactNode;
    saveLabel: string;
    /** The Cancel button — rendered by the route so it can choose its
     *  navigation target. */
    cancelButton: ReactNode;
    saving: boolean;
    errorMessage: string | null;
    /** Caller-side gate (e.g. folder-name validation in create mode).
     *  Defaults to true; AND-ed with internal validation + saving state. */
    canSave?: boolean;
    onSave: (markdown: string) => void;
}

export function TeamForm({
    initialMembers,
    initialNotes,
    teamName,
    folderInput,
    saveLabel,
    cancelButton,
    saving,
    errorMessage,
    canSave = true,
    onSave,
}: Props) {
    const [members, setMembers] = useState<MemberFormState[]>(initialMembers);
    const [notes, setNotes] = useState<NotesState>(initialNotes);
    const [openSlots, setOpenSlots] = useState<string[]>(['slot-1']);

    const { data: pokemonList } = useQuery({
        queryKey: ['pokemon'],
        queryFn: getPokemonList,
    });
    const { data: itemList } = useQuery({
        queryKey: ['items', 'holdable', 'pc'],
        queryFn: () => getItems({ holdable: true, pcOnly: true }),
    });

    // Per-slot detail (ability + move display names). Slots without a
    // pokemon picked have enabled:false and contribute nothing.
    const detailQueries = useQueries({
        queries: members.map((m) => ({
            queryKey: ['pokemon', m.pokemonId],
            queryFn: () => getPokemonDetail(m.pokemonId!),
            enabled: m.pokemonId !== null,
        })),
    });

    const validation = useMemo(() => {
        const issues: string[] = [];
        members.forEach((m, i) => {
            const slot = i + 1;
            if (m.pokemonId === null) issues.push(`Slot ${slot}: pick a Pokemon`);
            if (m.pokemonId !== null && m.abilityId === null) issues.push(`Slot ${slot}: pick an ability`);
            if (m.pokemonId !== null && !m.nature) issues.push(`Slot ${slot}: pick a nature`);
            if (m.pokemonId !== null && m.moveIds.every((id) => id === null)) {
                issues.push(`Slot ${slot}: pick at least one move`);
            }
            if (evTotal(m.evs) > EV_TOTAL_CAP) {
                issues.push(`Slot ${slot}: EVs total ${evTotal(m.evs)} > ${EV_TOTAL_CAP}`);
            }
        });
        return issues;
    }, [members]);

    const submitDisabled = !canSave || validation.length > 0 || saving;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (submitDisabled) return;
        const markdown = buildMarkdown({
            teamName,
            members,
            notes,
            pokemonList: pokemonList ?? [],
            itemList: itemList ?? [],
            details: detailQueries.map((q) => q.data ?? null),
        });
        onSave(markdown);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Folder name</label>
                {folderInput}
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Members</label>
                <Accordion
                    type="multiple"
                    value={openSlots}
                    onValueChange={setOpenSlots}
                    className="flex flex-col gap-2"
                >
                    {members.map((m, i) => (
                        <MemberCard
                            key={i}
                            slot={i + 1}
                            value={m}
                            onChange={(next) => setMembers((prev) => prev.map((p, j) => (j === i ? next : p)))}
                        />
                    ))}
                </Accordion>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Notes</label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <NoteField label="Lead pair" value={notes.leadPair}
                        onChange={(v) => setNotes((n) => ({ ...n, leadPair: v }))} />
                    <NoteField label="Back pair" value={notes.backPair}
                        onChange={(v) => setNotes((n) => ({ ...n, backPair: v }))} />
                    <NoteField label="Mega holder" value={notes.megaHolder}
                        onChange={(v) => setNotes((n) => ({ ...n, megaHolder: v }))} />
                    <NoteField label="Other" value={notes.other}
                        onChange={(v) => setNotes((n) => ({ ...n, other: v }))} />
                </div>
            </div>

            {validation.length > 0 && (
                <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <div className="font-semibold mb-1">Fix these before saving:</div>
                    <ul className="list-disc pl-4">
                        {validation.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                </div>
            )}

            <ErrorBanner>{errorMessage}</ErrorBanner>

            <div className="flex gap-2">
                <Button type="submit" disabled={submitDisabled}>
                    {saving ? 'Saving…' : saveLabel}
                </Button>
                {cancelButton}
            </div>
        </form>
    );
}

function NoteField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}
