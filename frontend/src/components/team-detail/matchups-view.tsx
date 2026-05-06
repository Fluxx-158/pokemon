import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import {
    createMatchup,
    deleteMatchup,
    getMatchup,
    getPokemonList,
    updateMatchup,
    type MatchupSummary,
} from '@/modules/api/endpoints';
import { ErrorBanner } from '@/components/error-banner';
import { MarkdownArticle } from '@/components/markdown-article';
import { MarkdownEditor } from '@/components/markdown-editor';
import { SpeciesSprite } from '@/components/species-sprite';
import { errorMessage } from '@/modules/api/api-client';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildPokemonLookup } from '@/lib/species-lookup';
import { isValidSlug } from '@/lib/team-validation';
import { cn } from '@/lib/utils';

const MATCHUP_TEMPLATE = `---
result: lost
encountered: 2026-05-02
opponent_lead: [Ceruledge, Froslass]
opponent_brought: [Ceruledge, Froslass, Pelipper, Mega Swampert]
opponent_six: [Ceruledge, Froslass, Pelipper, Mega Swampert, Tornadus, Dragonite]
---

# Matchup: <archetype or key threats>

> **Encountered:** <date> · **Result:** <won / lost / how it played out in 1-2 lines>

## What you faced

| Field | Detail |
|---|---|
| **Opponent's 6** | <species; note items/abilities> |
| **They brought (4)** | <species> |
| **They led (2)** | <species + species> |
| **Held in reserve** | <remaining 2> |

**Archetype read:** <one sentence>

---

## Diagnosis: why this lead beat your default plan

<3-5 sentences>

---

## Re-match plan

### Bring (4 of 6): <species / species / species / species>

### Lead: <species + species>

### Turn-by-turn

| T | <P1> | <P2> | Notes |
|---|---|---|---|
| **1** | <move> | <move> | <interaction> |
| **2** | <move> | <move> | <state> |

---

## Hard rules vs this lead

- **NEVER <action>**: <reason>

---

## Branches if they deviate

| If they lead | Your lead | T1 plan |
|---|---|---|
| <pair> | <your pair> | <move> / <move> |
`;

function ResultBadge({ result }: { result: string | null }) {
    if (!result) return null;
    const r = result.toLowerCase();
    const cls = r.includes('won') || r === 'win'
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
        : r.includes('lost') || r === 'loss'
            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    return (
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider', cls)}>
            {result}
        </span>
    );
}

interface Props {
    teamId: number;
    sourceFolder: string;
    matchups: MatchupSummary[];
}

export function MatchupsView({ teamId, sourceFolder, matchups }: Props) {
    const queryClient = useQueryClient();
    const [selectedSlug, setSelectedSlug] = useState<string | null>(matchups[0]?.slug ?? null);
    const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
    const [draftSlug, setDraftSlug] = useState('');
    const [draftMarkdown, setDraftMarkdown] = useState('');

    const { data: pokemonList } = useQuery({
        queryKey: ['pokemon'],
        queryFn: getPokemonList,
    });
    const pokemonLookup = useMemo(() => buildPokemonLookup(pokemonList), [pokemonList]);

    // Effect (not setState-during-render) so React doesn't re-run the body just
    // to discard our work when the list changes underneath us.
    useEffect(() => {
        if (mode !== 'view') return;
        if (selectedSlug && !matchups.some((m) => m.slug === selectedSlug)) {
            setSelectedSlug(matchups[0]?.slug ?? null);
        }
    }, [matchups, selectedSlug, mode]);

    const detail = useQuery({
        queryKey: ['teams', teamId, 'matchups', selectedSlug],
        queryFn: () => getMatchup(teamId, selectedSlug!),
        enabled: selectedSlug !== null && mode !== 'create',
    });

    const refreshTeam = async () => {
        await queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
    };

    const createM = useMutation({
        mutationFn: () => createMatchup(teamId, { slug: draftSlug.trim(), markdown: draftMarkdown }),
        onSuccess: async (created) => {
            await refreshTeam();
            await queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'matchups', created.slug] });
            setSelectedSlug(created.slug);
            setMode('view');
        },
    });

    const updateM = useMutation({
        mutationFn: () => updateMatchup(teamId, selectedSlug!, { markdown: draftMarkdown }),
        onSuccess: async () => {
            await refreshTeam();
            await queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'matchups', selectedSlug] });
            setMode('view');
        },
    });

    const deleteM = useMutation({
        mutationFn: () => deleteMatchup(teamId, selectedSlug!),
        onSuccess: async () => {
            await refreshTeam();
            const remaining = matchups.filter((m) => m.slug !== selectedSlug);
            setSelectedSlug(remaining[0]?.slug ?? null);
            setMode('view');
        },
    });

    const startCreate = () => {
        setDraftSlug('');
        setDraftMarkdown(MATCHUP_TEMPLATE);
        createM.reset();
        setMode('create');
    };

    const startEdit = () => {
        setDraftMarkdown(detail.data?.markdown ?? '');
        updateM.reset();
        setMode('edit');
    };

    const slugError = mode === 'create' && draftSlug.length > 0 && !isValidSlug(draftSlug.trim())
        ? 'Slug must be lowercase letters, digits, and single hyphens (e.g. "rain-ghost-froslass")'
        : null;
    const slugTaken = mode === 'create' && matchups.some((m) => m.slug === draftSlug.trim())
        ? 'A matchup with this slug already exists'
        : null;
    const canCreate = mode === 'create'
        && draftSlug.trim().length > 0
        && !slugError
        && !slugTaken
        && draftMarkdown.trim().length > 0
        && !createM.isPending;

    const mutationError = (m: typeof createM | typeof updateM | typeof deleteM): string | null =>
        m.isError ? errorMessage(m.error, 'Operation failed') : null;

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
            <aside className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                    <h2 className="dossier-eyebrow">Matchups</h2>
                    <Button size="sm" type="button" variant="outline" onClick={startCreate}>
                        + New
                    </Button>
                </div>
                {matchups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No matchups yet.</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {matchups.map((m) => (
                            <li key={m.slug}>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedSlug(m.slug); setMode('view'); }}
                                    className={cn(
                                        'w-full text-left rounded-md border px-3 py-2 text-sm transition-colors',
                                        selectedSlug === m.slug && mode !== 'create'
                                            ? 'bg-accent/40 border-accent-foreground/30'
                                            : 'hover:bg-accent/20',
                                    )}
                                >
                                    {m.frontmatter.opponent_lead && m.frontmatter.opponent_lead.length > 0 && (
                                        <div className="flex items-center gap-0.5 mb-1">
                                            {m.frontmatter.opponent_lead.map((n) => (
                                                <SpeciesSprite key={n} name={n} lookup={pokemonLookup} size={28} />
                                            ))}
                                        </div>
                                    )}
                                    <div className="font-medium truncate">{m.title}</div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                        <ResultBadge result={m.frontmatter.result} />
                                        {m.frontmatter.encountered && (
                                            <span className="text-[10px] text-muted-foreground">
                                                {m.frontmatter.encountered}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                                        {m.slug}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>

            <section className="flex flex-col gap-3 min-w-0">
                {mode === 'create' ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold">New matchup</h3>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() => createM.mutate()}
                                    disabled={!canCreate}
                                >
                                    {createM.isPending ? 'Creating…' : 'Create'}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setMode('view'); createM.reset(); }}
                                    disabled={createM.isPending}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                Slug (filename in <code className="rounded bg-muted px-1 py-0.5 text-[10px]">Teams/{sourceFolder}/matchups/</code>)
                            </label>
                            <Input
                                value={draftSlug}
                                onChange={(e) => setDraftSlug(e.target.value)}
                                placeholder="rain-ghost-froslass-ceruledge"
                                className="max-w-md font-mono"
                            />
                            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                            {!slugError && slugTaken && <p className="text-xs text-destructive">{slugTaken}</p>}
                        </div>
                        <MarkdownEditor value={draftMarkdown} onChange={setDraftMarkdown} />
                        <ErrorBanner>{mutationError(createM)}</ErrorBanner>
                    </div>
                ) : selectedSlug === null ? (
                    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                        No matchups for this team yet. Click <em>+ New</em> to add one.
                    </div>
                ) : detail.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : detail.error ? (
                    <p className="text-sm text-destructive">
                        {detail.error instanceof Error ? detail.error.message : 'Failed to load matchup'}
                    </p>
                ) : !detail.data ? null : mode === 'edit' ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-semibold">{detail.data.title}</h3>
                                <p className="text-[10px] text-muted-foreground font-mono">{detail.data.slug}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() => updateM.mutate()}
                                    disabled={updateM.isPending || draftMarkdown.trim().length === 0}
                                >
                                    {updateM.isPending ? 'Saving…' : 'Save'}
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setMode('view'); updateM.reset(); }}
                                    disabled={updateM.isPending}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                        <MarkdownEditor value={draftMarkdown} onChange={setDraftMarkdown} />
                        <ErrorBanner>{mutationError(updateM)}</ErrorBanner>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-semibold">{detail.data.title}</h3>
                                <p className="text-[10px] text-muted-foreground font-mono">{detail.data.slug}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" type="button" variant="outline" onClick={startEdit}>
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this matchup?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Permanently deletes <code className="rounded bg-muted px-1 py-0.5 text-xs">Teams/{sourceFolder}/matchups/{detail.data.slug}.md</code>. This cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <ErrorBanner>{mutationError(deleteM)}</ErrorBanner>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={deleteM.isPending}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(e) => { e.preventDefault(); deleteM.mutate(); }}
                                                disabled={deleteM.isPending}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                {deleteM.isPending ? 'Deleting…' : 'Delete'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        <MarkdownArticle source={detail.data.markdown} />
                    </div>
                )}
            </section>
        </div>
    );
}
