import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface ApiEndpointOptions {
    statusCode?: number;
    noEnvelope?: boolean;
}

// Reflector-backed decorator. Apply on a controller class or a single
// handler to mark its envelope/status behavior. Merged class -> handler
// (handler wins on conflicts) by getEndpointOptions.
export const ApiEndpoint = Reflector.createDecorator<ApiEndpointOptions>();

export function getEndpointOptions(reflector: Reflector, context: ExecutionContext): ApiEndpointOptions {
    return reflector.getAllAndMerge(ApiEndpoint, [context.getClass(), context.getHandler()]);
}
