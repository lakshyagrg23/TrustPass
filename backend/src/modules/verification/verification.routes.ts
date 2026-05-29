import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verify, getShareByToken } from './verification.controller';
import { validate } from '../../middleware/validate.middleware';
import { verifyCredentialSchema } from '../credentials/credentials.schema';

const router = Router();

// Strict rate limiting on the verification endpoint to prevent brute force
const verifyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many verification attempts. Please try again later.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @openapi
 * /api/credentials/verify:
 *   post:
 *     summary: Cryptographically verify a Verifiable Presentation
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [presentationToken]
 *             properties:
 *               presentationToken:
 *                 type: string
 *                 description: JWT-encoded Verifiable Presentation
 *     responses:
 *       200:
 *         description: Verification result (check `verified` field in response)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 credentialId:
 *                   type: string
 *                 issuerName:
 *                   type: string
 *                 disclosedClaims:
 *                   type: object
 *                 fieldResults:
 *                   type: array
 *                 checks:
 *                   type: object
 */
router.post('/verify', verifyRateLimit, validate(verifyCredentialSchema), verify);

/**
 * @openapi
 * /api/shares:
 *   get:
 *     summary: Fetch a presentation token by query param (for QR scan landing)
 *     tags: [Verification]
 *     parameters:
 *       - name: token
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presentation token
 */
router.get('/shares', getShareByToken);

export default router;
