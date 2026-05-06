import { createLazyFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getTeamDetail,
    updateTeam,
} from '@/modules/api/endpoints';
import { errorMessage } from '@/modules/api/api-client';
import { membersFromDetail, notesFromDetail } from '@/components/team-builder/hydrate';
import { TeamForm } from '@/components/team-builder/team-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createLazyFileRoute('/teams/$id/edit')({
    component: EditTeamPage,
});

function EditTeamPage() {
    // Params are parsed by the parent layout at /teams/$id.
    const { id } = useParams({ from: '/teams/$id' });
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: team, isLoading, error } = useQuery({
        queryKey: ['teams', id],
        queryFn: () => getTeamDetail(id),
    });

    const mutation = useMutation({
        mutationFn: (markdown: string) => updateTeam(id, { markdown }),
        onSuccess: async (updated) => {
            await queryClient.invalidateQueries({ queryKey: ['teams'] });
            await queryClient.invalidateQueries({ queryKey: ['teams', id] });
            navigate({ to: '/teams/$id', params: { id: updated.id } });
        },
    });

    if (isLoading) return <p className="px-6 py-4 text-muted-foreground">Loading…</p>;
    if (error) {
        return (
            <p className="px-6 py-4 text-destructive">
                {error instanceof Error ? error.message : 'Failed to load team'}
            </p>
        );
    }
    if (!team) return null;

    const errMsg = mutation.isError ? errorMessage(mutation.error, 'Failed to save team') : null;

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div>
                <Link
                    to="/teams/$id"
                    params={{ id: team.id }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    ← Back to team
                </Link>
            </div>

            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Edit team</h1>
                <p className="text-sm text-muted-foreground">
                    Saving rewrites <code className="rounded bg-muted px-1 py-0.5 text-xs">Teams/{team.sourceFolder}/team.md</code> and replaces the team's members in the database. To rename, use the Rename button on the team page.
                </p>
            </div>

            <TeamForm
                // Keyed on team id so navigating between edit pages remounts
                // the form with the new team's initial state.
                key={team.id}
                initialMembers={membersFromDetail(team)}
                initialNotes={notesFromDetail(team)}
                teamName={team.name}
                folderInput={
                    <Input
                        type="text"
                        value={team.sourceFolder}
                        readOnly
                        disabled
                        className="max-w-md"
                    />
                }
                saveLabel="Save changes"
                cancelButton={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate({ to: '/teams/$id', params: { id: team.id } })}
                        disabled={mutation.isPending}
                    >
                        Cancel
                    </Button>
                }
                saving={mutation.isPending}
                errorMessage={errMsg}
                onSave={(markdown) => mutation.mutate(markdown)}
            />
        </section>
    );
}
