import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, Observable } from 'rxjs';
import { applicationError, businessError, errorResponse } from './envelope';
import { BaseException, BusinessException } from './exceptions';

@Injectable()
export class GenericExceptionInterceptor implements NestInterceptor {

    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {

        return next.handle().pipe(
            catchError((err: unknown) => {
                if (err instanceof BaseException === false) {
                    throw err;
                }

                const baseErr = err as BaseException;
                const httpStatus = baseErr.httpStatus
                    ?? (baseErr instanceof BusinessException ? 400 : 500);

                const factory = baseErr instanceof BusinessException ? businessError : applicationError;
                const error = factory({
                    message: baseErr.message,
                    code: baseErr.code,
                    display: baseErr.display,
                });

                throw new HttpException(errorResponse(error, { httpStatus }), httpStatus);
            }),
        );
    }
}
