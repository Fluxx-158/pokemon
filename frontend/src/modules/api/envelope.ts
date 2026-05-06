export const ENVELOPE_SCHEMA = 'pokemon-champions/v1';

export type EnvelopeErrorType = 'business' | 'application';

export interface EnvelopeError {
    type: EnvelopeErrorType;
    code?: string;
    message: string;
    display?: boolean;
}

export interface Envelope<T> {
    schema?: string;
    httpStatus?: number;
    data?: T;
    errors?: EnvelopeError[];
}

export function isEnvelope(value: unknown): value is Envelope<unknown> {
    return (
        typeof value === 'object'
        && value !== null
        && 'schema' in value
        && (value as { schema: unknown }).schema === ENVELOPE_SCHEMA
    );
}
