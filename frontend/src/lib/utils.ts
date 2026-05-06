import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Coerce a string from a number input into an integer in [lo, hi]. Empty /
// non-numeric input snaps to `lo`, which keeps the calc forms usable while
// the user is mid-edit (no NaN propagation into damage rolls).
export function clampInt(raw: string, lo: number, hi: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, Math.floor(n)));
}

// Capitalize the first character of a string. Used for move types coming
// out of the API in lowercase ('water' → 'Water') so they line up with the
// type-pill colour table.
export function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
