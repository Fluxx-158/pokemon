import { useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { errorMessage } from '@/modules/api/api-client';
import type { BackdropEntry } from '@/modules/api/endpoints';
import { cn } from '@/lib/utils';
import { useBackdrop } from './backdrop-context';
import { BUILTIN_PRESETS } from './presets';

// Soft cap on the file picker side. Backend enforces 100 MB hard cap; this
// is the same number so the user gets a fast client-side reject before we
// even base64-encode the file.
const MAX_FILE_BYTES = 100 * 1024 * 1024;

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackdropPicker() {
    const { active, setActive, customs, addCustom, removeCustom } = useBackdrop();
    const fileRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (file: File | null | undefined) => {
        setError(null);
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) {
            setError(`File too large (${formatSize(file.size)}). Max 100 MB.`);
            return;
        }
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            setError('Only image and video files are accepted.');
            return;
        }
        try {
            setUploading(true);
            const created = await addCustom(file);
            setActive(created.name);
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    title="Backdrop"
                >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">Backdrop</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[300px] p-2">
                <div className="dossier-eyebrow mb-2">Built-in</div>
                <ul className="flex flex-col gap-1">
                    {BUILTIN_PRESETS.map((p) => (
                        <li key={p.key}>
                            <button
                                type="button"
                                onClick={() => setActive(p.key)}
                                className={cn(
                                    'w-full flex items-center gap-3 rounded px-2 py-1.5 text-left transition-colors',
                                    active === p.key
                                        ? 'bg-accent/60 ring-1 ring-foreground/40'
                                        : 'hover:bg-accent/30',
                                )}
                            >
                                <span
                                    aria-hidden
                                    className="block h-9 w-12 rounded border border-foreground/30 shrink-0"
                                    style={p.thumb}
                                />
                                <span className="flex flex-col leading-tight min-w-0">
                                    <span className="text-sm font-medium truncate">{p.label}</span>
                                    {p.note && (
                                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                                            {p.note}
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>

                <div className="dossier-eyebrow mt-3 mb-2 flex items-center justify-between">
                    <span>Your uploads</span>
                    <span className="text-[10px] font-mono text-muted-foreground normal-case tracking-normal">
                        {customs.length}
                    </span>
                </div>
                {customs.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground italic">
                        No uploads yet.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {customs.map((c) => (
                            <CustomRow
                                key={c.name}
                                custom={c}
                                active={active === c.name}
                                onSelect={() => setActive(c.name)}
                                onRemove={() => removeCustom(c.name)}
                            />
                        ))}
                    </ul>
                )}

                <div className="mt-2 flex flex-col gap-1.5 border-t pt-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-1.5"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {uploading ? 'Uploading…' : 'Add backdrop'}
                    </Button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    <p className="px-1 text-[10px] text-muted-foreground leading-snug">
                        Image or video. Stored at <code className="font-mono">frontend/public/backdrops/</code>.
                    </p>
                    {error && (
                        <p className="px-1 text-[11px] text-destructive">{error}</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function CustomRow({
    custom, active, onSelect, onRemove,
}: {
    custom: BackdropEntry;
    active: boolean;
    onSelect: () => void;
    onRemove: () => void;
}) {
    return (
        <li className="group relative">
            <button
                type="button"
                onClick={onSelect}
                className={cn(
                    'w-full flex items-center gap-3 rounded px-2 py-1.5 text-left transition-colors pr-8',
                    active
                        ? 'bg-accent/60 ring-1 ring-foreground/40'
                        : 'hover:bg-accent/30',
                )}
            >
                <span
                    aria-hidden
                    className="flex h-9 w-12 items-center justify-center rounded border border-foreground/30 shrink-0 bg-muted/40"
                >
                    {custom.kind === 'video'
                        ? <Film className="h-4 w-4 text-muted-foreground" />
                        : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                </span>
                <span className="flex flex-col leading-tight min-w-0">
                    <span className="text-sm font-medium truncate">{custom.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                        {custom.kind} · {formatSize(custom.size)}
                    </span>
                </span>
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Delete"
                className={cn(
                    'absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity',
                    'group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive',
                )}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </li>
    );
}
