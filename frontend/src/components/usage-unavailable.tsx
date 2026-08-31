// Shown in place of a meta/usage surface when there's no usage data, either
// the app is in offline mode (backend USAGE_SYNC_ENABLED=false) or it was never
// synced. Keeps the panels from looking broken/empty.

export function UsageUnavailable({ what = 'Usage data' }: { what?: string }) {
    return (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{what} unavailable.</span>{' '}
            Run <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run sync:usage</code> to fetch it,
            or the app is in offline mode (<code className="rounded bg-muted px-1 py-0.5 text-xs">USAGE_SYNC_ENABLED=false</code>).
            The rest of the app works without it.
        </div>
    );
}
