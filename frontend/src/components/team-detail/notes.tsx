import type { TeamDetail } from '@/modules/api/endpoints';

export function hasAnyNote(notes: TeamDetail['notes']): boolean {
    if (!notes) return false;
    return Boolean(
        notes.lead_pair
            || notes.back_pair
            || notes.mega_holder
            || (notes.other && notes.other.length > 0),
    );
}

export function NoteRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider min-w-[96px]">{label}</span>
            <span className="text-sm">{value}</span>
        </div>
    );
}
