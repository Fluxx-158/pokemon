import { PcNotesBlock } from '@/components/pc-notes-block';

export interface ItemDescriptionProps {
    displayName: string;
    category?: string | null;
    shortEffect: string | null;
    effect: string | null;
    pcAvailable?: boolean;
    pcNotes: string | null;
    isMegaStone?: boolean;
}

export function ItemDescription({
    displayName,
    category,
    shortEffect,
    effect,
    pcAvailable,
    pcNotes,
    isMegaStone,
}: ItemDescriptionProps) {
    const showFull = effect && effect !== shortEffect;
    return (
        <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{displayName}</span>
                {isMegaStone && (
                    <span className="dossier-foil rounded px-1.5 py-0.5 text-[10px] font-semibold">
                        Mega Stone
                    </span>
                )}
                {pcAvailable === false && (
                    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Not in PC
                    </span>
                )}
            </div>
            {category && (
                <div className="text-xs text-muted-foreground">Category: {category}</div>
            )}
            {shortEffect && <p className="text-sm">{shortEffect}</p>}
            {showFull && (
                <p className="text-xs text-muted-foreground whitespace-pre-line">{effect}</p>
            )}
            {!shortEffect && !effect && (
                <p className="text-xs italic text-muted-foreground">No description on file.</p>
            )}
            {pcNotes && <PcNotesBlock notes={pcNotes} />}
        </div>
    );
}
