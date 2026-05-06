// Mirror of the backend's folder + slug validation regexes. Kept in lockstep
// with backend/src/teams/teams-service.ts (search INVALID_FOLDER / VALID_SLUG)
// so client-side hints match what the API will accept.

// Reject anything that could escape the Teams/ folder or break Windows paths.
export const INVALID_FOLDER_RE = /[\\/:*?"<>|]|\.\./;

// Matchup slugs: lowercase, hyphen-separated alphanumeric.
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isInvalidFolder(s: string): boolean {
    return INVALID_FOLDER_RE.test(s);
}

export function isValidSlug(s: string): boolean {
    return SLUG_RE.test(s);
}
