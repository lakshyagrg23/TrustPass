import { Request, Response } from 'express';
import {
  issueCredential,
  listCredentials,
  getCredential,
  shareCredential,
  deleteCredential,
  getAllShares,
} from './credentials.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function issue(req: Request, res: Response): Promise<void> {
  const result = await issueCredential(req.user!.userId, req.body);
  sendSuccess(res, result, 'Credential issued successfully', 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const credentials = await listCredentials(req.user!.userId);
  sendSuccess(res, credentials);
}

export async function getOne(req: Request<{ id: string }>, res: Response): Promise<void> {
  try {
    const credential = await getCredential(req.params.id, req.user!.userId);
    sendSuccess(res, credential);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CREDENTIAL_NOT_FOUND') {
      sendError(res, 'Credential not found', 404, 'CREDENTIAL_NOT_FOUND');
    } else {
      throw err;
    }
  }
}

export async function share(req: Request, res: Response): Promise<void> {
  try {
    const result = await shareCredential(req.user!.userId, req.body);
    sendSuccess(res, result, 'Verifiable Presentation created');
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'CREDENTIAL_NOT_FOUND') {
        sendError(res, 'Credential not found', 404, 'CREDENTIAL_NOT_FOUND');
      } else if (err.message.startsWith('INVALID_FIELDS:')) {
        const fields = err.message.replace('INVALID_FIELDS:', '');
        sendError(res, `Unknown fields: ${fields}`, 400, 'INVALID_FIELDS');
      } else if (err.message.startsWith('LEGACY_CREDENTIAL:')) {
        sendError(
          res,
          'This credential was issued before cryptographic salting was introduced. Please delete it and re-issue to enable secure sharing.',
          400,
          'LEGACY_CREDENTIAL',
        );
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }
}


export async function remove(req: Request<{ id: string }>, res: Response): Promise<void> {
  try {
    await deleteCredential(req.params.id, req.user!.userId);
    sendSuccess(res, null, 'Credential deleted successfully');
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CREDENTIAL_NOT_FOUND') {
      sendError(res, 'Credential not found', 404, 'CREDENTIAL_NOT_FOUND');
    } else {
      throw err;
    }
  }
}

export async function listAllShares(req: Request, res: Response): Promise<void> {
  const shares = await getAllShares(req.user!.userId);
  sendSuccess(res, shares);
}
