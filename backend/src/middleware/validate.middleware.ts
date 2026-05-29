import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).flatten().fieldErrors;
      sendError(
        res,
        Object.entries(errors)
          .map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`)
          .join(' | '),
        422,
        'VALIDATION_ERROR',
      );
      return;
    }
    req.body = result.data;
    next();
  };
}
