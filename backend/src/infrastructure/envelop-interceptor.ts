import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyReply } from 'fastify';
import { map, Observable } from 'rxjs';
import { getEndpointOptions } from './api-endpoint';
import { EnvelopeImpl, successResponse } from './envelope';

@Injectable()
export class EnvelopInterceptor implements NestInterceptor {

    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {

        const endpointOptions = getEndpointOptions(this.reflector, context);
        const stream = next.handle();

        if (endpointOptions.noEnvelope) {
            return stream;
        }

        const reply: FastifyReply = context.switchToHttp().getResponse();

        return stream.pipe(
            map((value) => {
                if (value instanceof EnvelopeImpl) {
                    if (value.httpStatus) {
                        reply.statusCode = value.httpStatus;
                    }
                    return value;
                }
                return successResponse(value);
            }),
        );
    }
}
