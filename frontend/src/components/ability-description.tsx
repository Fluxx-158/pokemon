import { PcNotesBlock } from '@/components/pc-notes-block';

export interface AbilityDescriptionProps {
    displayName: string;
    shortEffect: string | null;
    effect: string | null;
    isHidden?: boolean;
    pcNotes: string | null;
}

export function AbilityDescription({
    displayName,
    shortEffect,
    effect,
    isHidden,
    pcNotes,
}: AbilityDescriptionProps) {
    const showFull = effect && effect !== shortEffect;
    return (
        <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
                <span className="font-semibold">{displayName}</span>
                {isHidden && (
                    <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-900 dark:bg-purple-900/60 dark:text-purple-200">
                        Hidden
                    </span>
                )}
            </div>
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
