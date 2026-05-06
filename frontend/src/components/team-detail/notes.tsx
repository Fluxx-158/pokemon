// Tiny helpers shared between the team detail page and any future component
// that surfaces team-level notes (lead pair, back pair, mega holder, free
// text). Pulled out of the megafile so the route shell stays focused on
// page-level orchestration.

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
