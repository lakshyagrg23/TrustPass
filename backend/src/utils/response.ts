import { Response } from 'express';
import type { ApiSuccess, ApiError } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): Response {
  const body: ApiSuccess<T> = { success: true, data, ...(message && { message }) };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  code?: string,
): Response {
  const body: ApiError = { success: false, message, ...(code && { code }) };
  return res.status(statusCode).json(body);
}
