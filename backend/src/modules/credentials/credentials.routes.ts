import { Router } from 'express';
import { issue, list, getOne, share, remove, listAllShares } from './credentials.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  issueCredentialSchema,
  shareCredentialSchema,
} from './credentials.schema';


import { verify, getShareByToken, getShareById } from '../verification/verification.controller';
import { verifyCredentialSchema } from './credentials.schema';
import rateLimit from 'express-rate-limit';

const router = Router();

// ── Public routes (no auth) ────────────────────────────────────────────────────
const verifyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many verification attempts. Please try again later.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/verify', verifyRateLimit, validate(verifyCredentialSchema), verify);
router.get('/share', getShareByToken);
router.get('/share/:shareId', getShareById);

// ── Protected routes (auth required) ─────────────────────────────────────────
router.use(authMiddleware);


/**
 * @openapi
 * /api/credentials/issue:
 *   post:
 *     summary: Issue a new cryptographically signed credential
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, degree, graduationYear, cgpa, marks, issuerName, issueDate]
 *             properties:
 *               name:
 *                 type: string
 *               degree:
 *                 type: string
 *               graduationYear:
 *                 type: integer
 *               cgpa:
 *                 type: number
 *               marks:
 *                 type: string
 *               issuerName:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Credential issued and signed
 */
router.post('/issue', validate(issueCredentialSchema), issue);

/**
 * @openapi
 * /api/credentials:
 *   get:
 *     summary: Get all credentials for authenticated user
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of credentials
 */
router.get('/', list);

/**
 * @openapi
 * /api/credentials/{id}:
 *   get:
 *     summary: Get a specific credential with full claim values
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Credential detail
 *       404:
 *         description: Not found
 */
router.get('/:id', getOne);

/**
 * @openapi
 * /api/credentials/share:
 *   post:
 *     summary: Create a Verifiable Presentation with selective disclosure
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credentialId, disclosedFields]
 *             properties:
 *               credentialId:
 *                 type: string
 *                 format: uuid
 *               disclosedFields:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiresIn:
 *                 type: string
 *                 enum: [1h, 24h, 7d, 30d]
 *     responses:
 *       200:
 *         description: VP created with share URL and QR code
 */
router.post('/share', validate(shareCredentialSchema), share);

/** DELETE /api/credentials/:id — delete a credential and all its shares */
router.delete('/:id', remove);

/** GET /api/credentials/shares/all — all shares across all credentials */
router.get('/shares/all', listAllShares);

export default router;
