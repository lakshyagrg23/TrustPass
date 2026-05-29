import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { env } from '../config/env';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[ERROR]', err.message);
  if (env.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  sendError(res, 'An unexpected error occurred', 500, 'INTERNAL_ERROR');
}
