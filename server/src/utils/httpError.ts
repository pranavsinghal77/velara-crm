/**
 * Errors thrown with a deliberate status code. Anything else that reaches the
 * error handler is treated as a 500 and its message is not sent to the client.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, 'bad_request', details);

export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, message, 'unauthorized');

export const forbidden = (message = 'You do not have permission to do that') =>
  new HttpError(403, message, 'forbidden');

export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');

export const conflict = (message: string) => new HttpError(409, message, 'conflict');

export const serviceUnavailable = (message: string) =>
  new HttpError(503, message, 'service_unavailable');
