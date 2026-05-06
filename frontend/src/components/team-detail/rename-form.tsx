import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isInvalidFolder } from '@/lib/team-validation';

interface Props {
    name: string;
    folder: string;
    onNameChange: (v: string) => void;
    onFolderChange: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
    pending: boolean;
    error: string | null;
}

export function RenameForm({
    name,
    folder,
    onNameChange,
    onFolderChange,
    onSave,
    onCancel,
    pending,
    error,
}: Props) {
    const folderError = folder.length > 0 && isInvalidFolder(folder)
        ? 'Folder name cannot contain slashes, colons, or path-traversal characters'
        : null;
    const canSave = !pending && !folderError && name.trim().length > 0 && folder.trim().length > 0;

    return (
        <div className="rounded-md border p-4 flex flex-col gap-3">
            <h2 className="dossier-eyebrow">Rename team</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Display name</label>
                    <Input value={name} onChange={(e) => onNameChange(e.target.value)} disabled={pending} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Folder name</label>
                    <Input value={folder} onChange={(e) => onFolderChange(e.target.value)} disabled={pending} />
                    {folderError && <p className="text-xs text-destructive">{folderError}</p>}
                    {!folderError && (
                        <p className="text-xs text-muted-foreground">
                            Will move <code className="rounded bg-muted px-1 py-0.5">Teams/{folder}/</code> on disk if changed
                        </p>
                    )}
                </div>
            </div>
            <ErrorBanner>{error}</ErrorBanner>
            <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onSave} disabled={!canSave}>
                    {pending ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}
