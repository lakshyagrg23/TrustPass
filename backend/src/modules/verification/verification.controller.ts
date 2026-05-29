import { Request, Response } from 'express';
import { verifyPresentation } from './verification.service';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../config/prisma';

export async function verify(req: Request, res: Response): Promise<void> {
  const { presentationToken } = req.body;
  const result = await verifyPresentation(presentationToken);

  // Increment access count if we have a matching share
  if (result.credentialId !== 'unknown') {
    prisma.share
      .updateMany({
        where: { presentationToken },
        data: { accessCount: { increment: 1 } },
      })
      .catch(() => {}); // Non-blocking, best-effort
  }

  // Always return 200 — the `verified` field in the body indicates result
  sendSuccess(res, result);
}

export async function getShareByToken(req: Request, res: Response): Promise<void> {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ success: false, message: 'Missing token parameter' });
    return;
  }

  // Just return the token directly — client will call /verify with it
  sendSuccess(res, { presentationToken: token });
}

/**
 * Lookup a share by its short ID (for QR code short URLs).
 * Returns the presentation token so the frontend can call /verify.
 */
export async function getShareById(req: Request, res: Response): Promise<void> {
  const { shareId } = req.params;
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: { presentationToken: true, expiresAt: true },
  });

  if (!share) {
    res.status(404).json({ success: false, message: 'Share link not found or expired', code: 'SHARE_NOT_FOUND' });
    return;
  }

  sendSuccess(res, { presentationToken: share.presentationToken });
}
