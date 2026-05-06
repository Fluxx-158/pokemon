import { Envelope, EnvelopeError, isEnvelope } from './envelope';

const baseUrl = import.meta.env.VITE_API_BASE_URL;

if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set');
}

export class ApiError extends Error {
    constructor(
        message: string,
        readonly httpStatus: number,
        readonly errors: EnvelopeError[],
    ) {
        super(message);
        this.name = 'ApiError';
    }

    get displayMessage(): string | null {
        const displayable = this.errors.find((e) => e.display && e.message);
        return displayable?.message ?? null;
    }

    hasCode(code: string): boolean {
        return this.errors.some((e) => e.code === code);
    }
}

// Standard "what should I show the user?" extractor for thrown values
// (mutation errors, query errors, anything caught from a fetch). Picks
// the structured display message off our envelope errors first, then
// falls back to the generic Error.message, then the supplied fallback.
// Always returns a string — caller gates on .isError or null themselves.
export function errorMessage(err: unknown, fallback = 'Operation failed'): string {
    if (err instanceof ApiError) return err.displayMessage ?? err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

async function unwrapEnvelope<T>(path: string, response: Response): Promise<T> {
    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new ApiError(
            `Non-JSON response from ${path} (status ${response.status})`,
            response.status,
            [],
        );
    }

    if (!isEnvelope(body)) {
        throw new ApiError(
            `Response from ${path} is not a pokemon-champions envelope`,
            response.status,
            [],
        );
    }

    const envelope = body as Envelope<T>;

    if (!response.ok || envelope.errors?.length) {
        const errors = envelope.errors ?? [];
        const summary = errors[0]?.message ?? `HTTP ${response.status} from ${path}`;
        throw new ApiError(summary, envelope.httpStatus ?? response.status, errors);
    }

    if (envelope.data === undefined) {
        throw new ApiError(
            `Envelope from ${path} is missing data`,
            response.status,
            [],
        );
    }

    return envelope.data;
}

export async function apiGet<T>(path: string): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`);
    return unwrapEnvelope<T>(path, response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return unwrapEnvelope<T>(path, response);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return unwrapEnvelope<T>(path, response);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return unwrapEnvelope<T>(path, response);
}

export async function apiDelete(path: string): Promise<void> {
    const response = await fetch(`${baseUrl}${path}`, { method: 'DELETE' });
    // 204 No Content is the happy path. For any other status, parse the
    // envelope so the caller still sees structured errors.
    if (response.status === 204) return;
    await unwrapEnvelope<unknown>(path, response);
}
