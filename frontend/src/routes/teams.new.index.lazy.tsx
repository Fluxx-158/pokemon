import { useMemo, useState } from 'react';
import { createLazyFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createTeam,
    getTeamDetail,
} from '@/modules/api/endpoints';
import { errorMessage } from '@/modules/api/api-client';
import { EV_TOTAL_CAP } from '@/components/pickers/ev-inputs';
import {
    EMPTY_NOTES,
} from '@/components/team-builder/markdown';
import { emptyMembers, membersFromDetail, notesFromDetail } from '@/components/team-builder/hydrate';
import { TeamForm } from '@/components/team-builder/team-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isInvalidFolder } from '@/lib/team-validation';

export const Route = createLazyFileRoute('/teams/new/')({
    component: NewTeamStructuredPage,
});

function NewTeamStructuredPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { from } = useSearch({ from: '/teams/new' });

    const [sourceFolder, setSourceFolder] = useState('');

    // Duplicate flow: load the source team so we can prefill members + notes.
    const sourceTeam = useQuery({
        queryKey: ['teams', from],
        queryFn: () => getTeamDetail(from!),
        enabled: from !== undefined,
    });

    const folderError = useMemo(() => {
        if (sourceFolder.length === 0) return null;
        if (isInvalidFolder(sourceFolder)) {
            return 'Folder name cannot contain slashes, colons, or path-traversal characters';
        }
        return null;
    }, [sourceFolder]);

    const mutation = useMutation({
        mutationFn: createTeam,
        onSuccess: async (team) => {
            await queryClient.invalidateQueries({ queryKey: ['teams'] });
            navigate({ to: '/teams/$id', params: { id: team.id } });
        },
    });

    const errMsg = mutation.isError ? errorMessage(mutation.error, 'Failed to create team') : null;

    // Defer mounting the form until the source team hydrates — otherwise
    // slot 1's always-open NatureSelect mounts with value='' before we can
    // populate it, and Radix Select doesn't reliably re-pick the value
    // when it changes. (Slots 2-6 dodge this because they mount lazily on
    // accordion expand.)
    if (from !== undefined && !sourceTeam.data) {
        return <p className="px-6 py-4 text-muted-foreground">Loading source team…</p>;
    }

    const initialMembers = sourceTeam.data ? membersFromDetail(sourceTeam.data) : emptyMembers();
    const initialNotes = sourceTeam.data ? notesFromDetail(sourceTeam.data) : EMPTY_NOTES;
    const folder = sourceFolder.trim();

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
                <Link to="/teams" className="text-sm text-muted-foreground hover:text-foreground">
                    ← Back to teams
                </Link>
                <Link to="/teams/new/markdown" className="text-sm text-muted-foreground hover:text-foreground">
                    Use markdown form →
                </Link>
            </div>

            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">New team</h1>
                <p className="text-sm text-muted-foreground">
                    Folder name doubles as the team name. Each slot's ability and moves are scoped to the picked Pokemon. EVs cap at 32 per stat and {EV_TOTAL_CAP} total.
                </p>
                {sourceTeam.data && (
                    <p className="text-xs text-muted-foreground">
                        Duplicating <span className="font-medium text-foreground">{sourceTeam.data.name}</span>
                        . Pick a new folder name to save the copy.
                    </p>
                )}
            </div>

            <TeamForm
                // Keyed on `from` so flipping into duplicate mode remounts the
                // form with the prefilled state instead of keeping the old
                // (empty) state.
                key={from ?? 'fresh'}
                initialMembers={initialMembers}
                initialNotes={initialNotes}
                teamName={folder}
                folderInput={
                    <>
                        <Input
                            type="text"
                            value={sourceFolder}
                            onChange={(e) => setSourceFolder(e.target.value)}
                            placeholder="e.g. Mega Greninja, Sun Offense"
                            className="max-w-md"
                            autoComplete="off"
                        />
                        {folderError && <p className="text-xs text-destructive">{folderError}</p>}
                        {!folderError && folder && (
                            <p className="text-xs text-muted-foreground">
                                Will save to <code className="rounded bg-muted px-1 py-0.5">Teams/{folder}/team.md</code>
                            </p>
                        )}
                    </>
                }
                saveLabel="Save team"
                cancelButton={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate({ to: '/teams' })}
                        disabled={mutation.isPending}
                    >
                        Cancel
                    </Button>
                }
                saving={mutation.isPending}
                errorMessage={errMsg}
                canSave={folder.length > 0 && !folderError}
                onSave={(markdown) => mutation.mutate({ sourceFolder: folder, markdown })}
            />
        </section>
    );
}
