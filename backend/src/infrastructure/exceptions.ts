export interface BaseExceptionParams {
    message: string;
    httpStatus?: number;
    code?: string;
    display?: boolean;
}

export class BaseException extends Error {
    httpStatus?: number;
    code?: string;
    display?: boolean = true;

    constructor(params: BaseExceptionParams) {
        super(params.message);
        this.httpStatus = params.httpStatus;
        this.code = params.code;
        if (params.display !== undefined) {
            this.display = params.display;
        }
    }
}

// Application-level (5xx by default): unexpected internal failure;
// the message is hidden from end users.
export class ApplicationException extends BaseException {
    constructor(params: BaseExceptionParams) {
        super({ display: false, ...params });
    }
}

// Business-level (4xx by default): a validated user-facing failure;
// the message is intended to be shown.
export class BusinessException extends BaseException {
    constructor(params: BaseExceptionParams) {
        super({ display: true, ...params });
    }
}
