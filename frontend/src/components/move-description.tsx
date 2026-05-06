import { MoveClassIcon } from '@/components/move-class-icon';
import { PcNotesBlock } from '@/components/pc-notes-block';
import { TypePill } from '@/components/type-pill';
import { capitalize } from '@/lib/utils';

export interface MoveDescriptionProps {
    displayName: string;
    type: string;       // lowercase from API; we capitalize for the pill
    damageClass: string;
    power: number | null;
    accuracy: number | null;
    ppPc: number;
    priority: number;
    effectChance: number | null;
    shortEffect: string | null;
    effect: string | null;
    pcNotes: string | null;
}

export function MoveDescription({
    displayName,
    type,
    damageClass,
    power,
    accuracy,
    ppPc,
    priority,
    effectChance,
    shortEffect,
    effect,
    pcNotes,
}: MoveDescriptionProps) {
    const showFull = effect && effect !== shortEffect;
    return (
        <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{displayName}</span>
                <TypePill name={capitalize(type)} />
                <MoveClassIcon cls={damageClass} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span>Pow: <span className="text-foreground">{power ?? '—'}</span></span>
                <span>Acc: <span className="text-foreground">{accuracy === null ? '—' : `${accuracy}%`}</span></span>
                <span>PP: <span className="text-foreground">{ppPc}</span></span>
                {priority !== 0 && (
                    <span>Pri: <span className="text-foreground">{priority > 0 ? `+${priority}` : priority}</span></span>
                )}
                {effectChance !== null && (
                    <span>Effect: <span className="text-foreground">{effectChance}%</span></span>
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
