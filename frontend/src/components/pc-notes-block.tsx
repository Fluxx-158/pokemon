export function PcNotesBlock({ notes }: { notes: string }) {
    return (
        <p className="rounded border-l-4 border-amber-400 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="font-semibold">PC: </span>{notes}
        </p>
    );
}
