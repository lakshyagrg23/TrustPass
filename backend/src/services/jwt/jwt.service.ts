import jwt from 'jsonwebtoken';
import type { VerifiablePresentation } from '../../types';
import { env } from '../../config/env';

/**
 * Sign a Verifiable Presentation as a JWT.
 * The JWT itself is signed with the server JWT_SECRET (transport integrity).
 * The VP internally contains the issuer's Ed25519 signature over the Merkle root
 * (cryptographic proof of authentic issuance).
 */
export function signPresentation(
  vp: VerifiablePresentation,
  expiresInSeconds: number,
): string {
  return jwt.sign(vp, env.JWT_SECRET, {
    expiresIn: expiresInSeconds,
    algorithm: 'HS256',
    issuer: 'trustpass-server',
  });
}

/**
 * Decode and verify a presentation JWT.
 * Throws if expired or tampered.
 */
export function verifyPresentationJwt(token: string): VerifiablePresentation {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'trustpass-server',
  });
  return decoded as VerifiablePresentation;
}

/**
 * Sign an auth JWT for a user.
 */
export function signAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, env.JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

/**
 * Verify an auth JWT.
 */
export function verifyAuthToken(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  return decoded as { userId: string; email: string };
}
