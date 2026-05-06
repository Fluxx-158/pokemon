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

const SCHEMA = 'pokemon-champions/v1';

export class EnvelopeImpl<T> implements Envelope<T> {
    schema?: string = SCHEMA;
    httpStatus?: number;
    data?: T;
    errors?: EnvelopeError[];
}

export class SuccessEnvelope<T> extends EnvelopeImpl<T> {
    declare data: T;
}

export function businessError(values: Omit<EnvelopeError, 'type'>): EnvelopeError {
    return { ...values, type: 'business' };
}

export function applicationError(values: Omit<EnvelopeError, 'type'>): EnvelopeError {
    return { ...values, type: 'application' };
}

export function successResponse<T>(data: T): SuccessEnvelope<T> {
    const result = new SuccessEnvelope<T>();
    result.data = data;
    return result;
}

export function errorResponse(error: EnvelopeError, options: { httpStatus: number }): Envelope<void> {
    const result = new EnvelopeImpl<void>();
    result.httpStatus = options.httpStatus;
    result.errors = [error];
    return result;
}
