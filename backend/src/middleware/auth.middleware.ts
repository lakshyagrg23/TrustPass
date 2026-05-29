import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../services/jwt/jwt.service';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Authorization token required', 401, 'UNAUTHORIZED');
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401, 'TOKEN_INVALID');
  }
}
