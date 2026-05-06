import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTeam } from '@/modules/api/endpoints';
import { errorMessage } from '@/modules/api/api-client';
import { ErrorBanner } from '@/components/error-banner';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isInvalidFolder } from '@/lib/team-validation';

export const Route = createFileRoute('/teams/new/markdown')({
    component: NewTeamMarkdownPage,
});

const TEMPLATE = `# Team name: <enter team name here>

## Pokemon 1
- **Species:**
- **Type:**
- **Ability:**
- **Nature:**
- **Held Item:**
- **Moves:**  /  /  /
- **Stats (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /
- **EVs (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /

## Pokemon 2
- **Species:**
- **Type:**
- **Ability:**
- **Nature:**
- **Held Item:**
- **Moves:**  /  /  /
- **Stats (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /
- **EVs (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /

## Pokemon 3
- **Species:**
- **Type:**
- **Ability:**
- **Nature:**
- **Held Item:**
- **Moves:**  /  /  /
- **Stats (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /
- **EVs (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /

## Pokemon 4
- **Species:**
- **Type:**
- **Ability:**
- **Nature:**
- **Held Item:**
- **Moves:**  /  /  /
- **Stats (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /
- **EVs (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /

## Pokemon 5
- **Species:**
- **Type:**
- **Ability:**
- **Nature:**
- **Held Item:**
- **Moves:**  /  /  /
- **Stats (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /
- **EVs (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /

## Pokemon 6
- **Species:**
- **Type:**
- **Ability:**
- **Nature:**
- **Held Item:**
- **Moves:**  /  /  /
- **Stats (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /
- **EVs (HP/Atk/Def/SpA/SpD/Spe):**  /  /  /  /  /

## Notes
- Mega Stone holder:
- Standard lead pair:
- Standard back pair:
- Anything else worth flagging:
`;

function NewTeamMarkdownPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [sourceFolder, setSourceFolder] = useState('');
    const [markdown, setMarkdown] = useState(TEMPLATE);

    const mutation = useMutation({
        mutationFn: createTeam,
        onSuccess: async (team) => {
            await queryClient.invalidateQueries({ queryKey: ['teams'] });
            navigate({ to: '/teams/$id', params: { id: team.id } });
        },
    });

    const folderError =
        sourceFolder.length > 0 && isInvalidFolder(sourceFolder)
            ? 'Folder name cannot contain slashes, colons, or path-traversal characters'
            : null;

    const canSubmit = sourceFolder.trim().length > 0 && !folderError && markdown.trim().length > 0 && !mutation.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        mutation.mutate({ sourceFolder: sourceFolder.trim(), markdown });
    };

    const errMsg = mutation.isError ? errorMessage(mutation.error, 'Failed to create team') : null;

    return (
        <section className="flex flex-col gap-4 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
                <Link to="/teams" className="text-sm text-muted-foreground hover:text-foreground">
                    ← Back to teams
                </Link>
                <Link to="/teams/new" className="text-sm text-muted-foreground hover:text-foreground">
                    Use structured form →
                </Link>
            </div>

            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">New team (markdown)</h1>
                <p className="text-sm text-muted-foreground">
                    Power-user form. Saving creates <code className="rounded bg-muted px-1 py-0.5 text-xs">Teams/&lt;folder&gt;/team.md</code> on disk and a matching DB record.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="folder" className="text-sm font-medium">
                        Folder name
                    </label>
                    <Input
                        id="folder"
                        type="text"
                        value={sourceFolder}
                        onChange={(e) => setSourceFolder(e.target.value)}
                        placeholder="e.g. Mega Greninja, Sun Offense"
                        className="max-w-md"
                        autoComplete="off"
                    />
                    {folderError && (
                        <p className="text-xs text-destructive">{folderError}</p>
                    )}
                    {!folderError && sourceFolder.trim() && (
                        <p className="text-xs text-muted-foreground">
                            Will save to <code className="rounded bg-muted px-1 py-0.5">Teams/{sourceFolder.trim()}/team.md</code>
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="markdown" className="text-sm font-medium">
                        Team markdown
                    </label>
                    <p className="text-xs text-muted-foreground">
                        Edit the template below. The first line should read <code className="rounded bg-muted px-1 py-0.5">{'# Team name: <name>'}</code>. Each Pokemon needs Species / Ability / Nature / Held Item / Moves / EVs filled in. Stats and Type lines are optional (we recompute stats from base + EVs + nature).
                    </p>
                    <MarkdownEditor
                        id="markdown"
                        value={markdown}
                        onChange={setMarkdown}
                        minHeight={480}
                        className="tabular-nums"
                    />
                </div>

                <ErrorBanner>{errMsg}</ErrorBanner>

                <div className="flex gap-2">
                    <Button type="submit" disabled={!canSubmit}>
                        {mutation.isPending ? 'Saving…' : 'Save team'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate({ to: '/teams' })}
                        disabled={mutation.isPending}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </section>
    );
}
