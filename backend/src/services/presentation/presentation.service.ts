import QRCode from 'qrcode';
import { env } from '../../config/env';
import { decrypt } from '../crypto/encryption.service';
import { buildMerkleTree, generateProofs } from '../merkle/merkle.service';
import { signPresentation } from '../jwt/jwt.service';
import type { MerkleProofs, VerifiablePresentation, ClaimSalts } from '../../types';

export interface CreatePresentationOptions {
  credentialId: string;
  encryptedClaims: string;
  claimSalts: ClaimSalts;       // per-field 32-byte hex salts from DB
  merkleRoot: string;
  issuerSignature: string;
  issuerPublicKey: string;
  issuerName: string;
  issuedAt: Date;
  disclosedFields: string[];
  expiresInSeconds: number;
  shareId?: string;             // if provided, QR uses short URL /verify?shareId=xxx
}

export interface PresentationResult {
  presentationToken: string;
  shareUrl: string;
  qrCodeDataUrl: string;
  expiresAt: Date;
  vp: VerifiablePresentation;
}

/**
 * Build a Verifiable Presentation for a subset of credential fields.
 *
 * Process:
 * 1. Decrypt the full claims (server-side only — never exposed to caller)
 * 2. Rebuild the Merkle tree using the stored per-field salts (deterministic)
 * 3. Generate Merkle proofs with salt for disclosed fields only
 *    → Hidden fields' salts are NEVER included → brute-force is infeasible
 * 4. Assemble the VP object containing only disclosed data + salted proofs
 * 5. Sign the VP as a JWT (transport integrity)
 * 6. Generate a QR code pointing to the share URL
 */
export async function createPresentation(
  opts: CreatePresentationOptions,
): Promise<PresentationResult> {
  // 1. Decrypt all claims (stays on server — never returned to client as plaintext)
  const encKey = Buffer.from(env.ENCRYPTION_KEY).toString('base64');
  const allClaims = JSON.parse(decrypt(opts.encryptedClaims, encKey)) as Record<string, unknown>;

  // 2. Validate that all requested fields exist in the credential
  for (const field of opts.disclosedFields) {
    if (!(field in allClaims)) {
      throw new Error(`Field "${field}" does not exist in this credential`);
    }
  }

  // 3. Rebuild Merkle tree using the same salts used at issuance
  //    (leaf = SHA256(0x00 || salt_field || "field:value") — deterministic with salts)
  const { tree, leafMap } = buildMerkleTree(allClaims, opts.claimSalts);

  // 4. Generate salted proofs for ONLY the disclosed fields
  //    Salt for field X is included → verifier can recompute leaf X
  //    Salts for hidden fields are NEVER included → brute-force search space = 2^256
  const merkleProofs: MerkleProofs = generateProofs(
    tree,
    leafMap,
    opts.claimSalts,
    opts.disclosedFields,
  );

  // 5. Build disclosed claims subset
  const disclosedClaims: Record<string, unknown> = {};
  for (const field of opts.disclosedFields) {
    disclosedClaims[field] = allClaims[field];
  }

  // 6. Assemble the VP
  const expiresAt = new Date(Date.now() + opts.expiresInSeconds * 1000);

  const vp: VerifiablePresentation = {
    credentialId: opts.credentialId,
    disclosedClaims,
    merkleProofs,
    merkleRoot: opts.merkleRoot,
    issuerSignature: opts.issuerSignature,
    issuerPublicKey: opts.issuerPublicKey,
    issuerName: opts.issuerName,
    issuedAt: opts.issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // 7. Sign VP as a JWT (transport integrity + expiry enforcement)
  const presentationToken = signPresentation(vp, opts.expiresInSeconds);

  // 8. Generate share URL + QR code
  const shareUrl = opts.shareId
    ? `${env.FRONTEND_URL}/verify?shareId=${opts.shareId}`
    : `${env.FRONTEND_URL}/verify?token=${presentationToken}`;

  const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });

  return {
    presentationToken,
    shareUrl,
    qrCodeDataUrl,
    expiresAt,
    vp,
  };
}
