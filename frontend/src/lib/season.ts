// Usage-data provenance helpers.
//
// The source reports the ranked-battle SEASON (e.g. "M4"), which rolls roughly
// monthly. That is NOT the regulation (e.g. "M-B", 17 Jun–2 Sep 2026), several
// seasons run inside one regulation, and the API doesn't expose the regulation
// at all. So UI labels show the season and stay correct across rollovers.

/** "M4" → "M-4"; anything else passes through unchanged. */
export function prettySeason(season: string | null | undefined): string | null {
    if (!season) return null;
    const m = season.match(/^M(\d+)$/i);
    return m ? `M-${m[1]}` : season;
}

/**
 * Prefix for a provenance line, e.g. `Season M-4 · `. Returns '' when the
 * season is unknown so callers can concatenate unconditionally.
 */
export function seasonLabel(season: string | null | undefined): string {
    const p = prettySeason(season);
    return p ? `Season ${p} · ` : '';
}
