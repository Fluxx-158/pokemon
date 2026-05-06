import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { updateTeamStrategy } from '@/modules/api/endpoints';
import { errorMessage } from '@/modules/api/api-client';
import { ErrorBanner } from '@/components/error-banner';
import { MarkdownArticle } from '@/components/markdown-article';
import { MarkdownEditor } from '@/components/markdown-editor';
import { Button } from '@/components/ui/button';

interface Props {
    teamId: number;
    markdown: string | null;
    sourceFolder: string;
}

export function StrategyView({ teamId, markdown, sourceFolder }: Props) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const mutation = useMutation({
        mutationFn: (next: string) => updateTeamStrategy(teamId, { markdown: next }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
            setEditing(false);
        },
    });

    const startEdit = () => {
        setDraft(markdown ?? '');
        setEditing(true);
    };

    const errMsg = mutation.isError ? errorMessage(mutation.error, 'Failed to save strategy') : null;

    if (editing) {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        Editing <code className="rounded bg-muted px-1 py-0.5 text-xs">Teams/{sourceFolder}/strategy.md</code>.
                        Save with an empty body to clear the file.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            type="button"
                            onClick={() => mutation.mutate(draft)}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => { setEditing(false); mutation.reset(); }}
                            disabled={mutation.isPending}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
                <MarkdownEditor
                    value={draft}
                    onChange={setDraft}
                    placeholder="## Team at a glance ..."
                />
                <ErrorBanner>{errMsg}</ErrorBanner>
            </div>
        );
    }

    if (!markdown) {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">No strategy on file yet.</span>
                    <Button size="sm" type="button" variant="outline" onClick={startEdit}>
                        <Pencil className="h-3.5 w-3.5" />
                        Write one
                    </Button>
                </div>
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                    No <code className="rounded bg-muted px-1 py-0.5 text-xs">strategy.md</code> on file at
                    {' '}<code className="rounded bg-muted px-1 py-0.5 text-xs">Teams/{sourceFolder}/</code>.
                    {' '}Click <em>Write one</em> to draft inline, or drop a
                    {' '}<code className="rounded bg-muted px-1 py-0.5 text-xs">strategy.md</code>
                    {' '}into that folder and reload.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-end">
                <Button size="sm" type="button" variant="outline" onClick={startEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                </Button>
            </div>
            <MarkdownArticle source={markdown} />
        </div>
    );
}
