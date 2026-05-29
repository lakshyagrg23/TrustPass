import { Request, Response } from 'express';
import { registerUser, loginUser, getMe } from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await registerUser(req.body);
    sendSuccess(res, result, 'Account created successfully', 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      sendError(res, 'An account with this email already exists', 409, 'EMAIL_TAKEN');
    } else {
      throw err;
    }
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await loginUser(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    } else {
      throw err;
    }
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getMe(req.user!.userId);
  sendSuccess(res, user);
}
