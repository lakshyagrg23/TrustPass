import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { encrypt, decrypt } from '../../services/crypto/encryption.service';
import { signMerkleRoot } from '../../services/crypto/ed25519.service';
import {
  buildMerkleTree,
  buildClaimHashes,
  generateClaimSalts,
} from '../../services/merkle/merkle.service';
import { createPresentation } from '../../services/presentation/presentation.service';
import type { IssueCredentialDto, ShareCredentialDto } from './credentials.schema';
import { EXPIRY_MAP } from './credentials.schema';
import type { ClaimSalts } from '../../types';

const encKey = () => Buffer.from(env.ENCRYPTION_KEY).toString('base64');

/**
 * Issue a new cryptographically signed credential.
 *
 * Steps:
 * 1. Generate one random 32-byte salt per claim field
 * 2. Build salted + domain-separated Merkle tree
 * 3. Sign Merkle root with Ed25519
 * 4. AES-256-GCM encrypt the raw claims
 * 5. Store credential with salts (salts are never returned via API)
 */
export async function issueCredential(userId: string, dto: IssueCredentialDto) {
  const claims = dto.claims as Record<string, unknown>;

  // 1. Generate per-field random salts — these blind each leaf hash
  const claimSalts: ClaimSalts = generateClaimSalts(claims);

  // 2. Build salted Merkle tree (leaf = SHA256(0x00 || salt || "field:value"))
  const { root } = buildMerkleTree(claims, claimSalts);

  // 3. Sign the Merkle root with Ed25519
  const issuerSignature = signMerkleRoot(root, env.ISSUER_PRIVATE_KEY);

  // 4. Build field-enumeration hashes (unsalted, for listing available fields)
  const claimHashes = buildClaimHashes(claims);

  // 5. Encrypt raw claims
  const encryptedClaims = encrypt(JSON.stringify(claims), encKey());

  // 6. Persist — claimSalts stay server-side, never exposed via API
  const credential = await prisma.credential.create({
    data: {
      userId,
      credentialType: dto.credentialType,
      credentialLabel: dto.credentialLabel,
      encryptedClaims,
      claimHashes,
      claimSalts, // stored for proof generation during sharing
      merkleRoot: root,
      issuerSignature,
      issuerPublicKey: env.ISSUER_PUBLIC_KEY,
      issuerName: env.ISSUER_NAME || 'TrustPass',
    },
    select: {
      id: true,
      credentialType: true,
      credentialLabel: true,
      issuerName: true,
      merkleRoot: true,
      issuedAt: true,
      claimHashes: true,
    },
  });

  return {
    credentialId: credential.id,
    credentialType: credential.credentialType,
    credentialLabel: credential.credentialLabel,
    issuerName: credential.issuerName,
    merkleRoot: credential.merkleRoot,
    issuedAt: credential.issuedAt,
    availableFields: Object.keys(claims),
    message: 'Credential issued and cryptographically signed',
  };
}

/**
 * List all credentials for a user (no sensitive data exposed).
 */
export async function listCredentials(userId: string) {
  const credentials = await prisma.credential.findMany({
    where: { userId },
    select: {
      id: true,
      credentialType: true,
      credentialLabel: true,
      issuerName: true,
      merkleRoot: true,
      issuedAt: true,
      claimHashes: true,
      _count: { select: { shares: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return credentials.map((c) => ({
    id: c.id,
    credentialType: c.credentialType,
    credentialLabel: c.credentialLabel,
    issuerName: c.issuerName,
    merkleRoot: c.merkleRoot,
    issuedAt: c.issuedAt,
    availableFields: Object.keys(c.claimHashes as Record<string, string>),
    shareCount: c._count.shares,
  }));
}

/**
 * Get credential detail (safe — returns field names and metadata, not values).
 */
export async function getCredential(credentialId: string, userId: string) {
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: {
      id: true,
      credentialType: true,
      credentialLabel: true,
      issuerName: true,
      merkleRoot: true,
      issuerPublicKey: true,
      issuedAt: true,
      claimHashes: true,
      encryptedClaims: true,
      shares: {
        select: {
          id: true,
          disclosedFields: true,
          expiresAt: true,
          createdAt: true,
          accessCount: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!credential) throw new Error('CREDENTIAL_NOT_FOUND');

  // Decrypt to return field values (owner has the right to see their own data)
  const claims = JSON.parse(
    decrypt(credential.encryptedClaims, encKey()),
  ) as Record<string, unknown>;

  return {
    id: credential.id,
    credentialType: credential.credentialType,
    credentialLabel: credential.credentialLabel,
    issuerName: credential.issuerName,
    merkleRoot: credential.merkleRoot,
    issuerPublicKey: credential.issuerPublicKey,
    issuedAt: credential.issuedAt,
    claims,
    availableFields: Object.keys(claims),
    shares: credential.shares,
  };
}

/**
 * Create a Verifiable Presentation (selective disclosure share).
 */
export async function shareCredential(userId: string, dto: ShareCredentialDto) {
  const credential = await prisma.credential.findFirst({
    where: { id: dto.credentialId, userId },
    select: {
      id: true,
      encryptedClaims: true,
      claimSalts: true, // ← needed for salted leaf proof generation
      claimHashes: true,
      merkleRoot: true,
      issuerSignature: true,
      issuerPublicKey: true,
      issuerName: true,
      issuedAt: true,
    },
  });

  if (!credential) throw new Error('CREDENTIAL_NOT_FOUND');

  // Validate that all requested fields exist
  const availableFields = Object.keys(credential.claimHashes as Record<string, string>);
  const invalidFields = dto.disclosedFields.filter((f) => !availableFields.includes(f));
  if (invalidFields.length > 0) {
    throw new Error(`INVALID_FIELDS:${invalidFields.join(',')}`);
  }

  const expiresInSeconds = EXPIRY_MAP[dto.expiresIn] ?? 86400;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  // Generate the shareId upfront so the VP can reference it in the QR URL,
  // then create the DB row in a single write with the real token.
  const shareId = randomUUID();

  // Build presentation — salts are passed so proofs are properly blinded
  const result = await createPresentation({
    credentialId: credential.id,
    encryptedClaims: credential.encryptedClaims,
    claimSalts: credential.claimSalts as ClaimSalts,
    merkleRoot: credential.merkleRoot,
    issuerSignature: credential.issuerSignature,
    issuerPublicKey: credential.issuerPublicKey,
    issuerName: credential.issuerName,
    issuedAt: credential.issuedAt,
    disclosedFields: dto.disclosedFields,
    expiresInSeconds,
    shareId,
  });

  // Single atomic write — no placeholder, no race condition
  await prisma.share.create({
    data: {
      id: shareId,
      credentialId: credential.id,
      disclosedFields: dto.disclosedFields,
      presentationToken: result.presentationToken,
      expiresAt,
    },
  });

  return {
    shareId,
    presentationToken: result.presentationToken,
    shareUrl: result.shareUrl,
    qrCodeDataUrl: result.qrCodeDataUrl,
    disclosedFields: dto.disclosedFields,
    expiresAt: result.expiresAt,
  };
}


/**
 * Delete a credential and all its shares (cascade).
 * Editing is intentionally not supported — any change to claims invalidates
 * the Ed25519 signature. Users should delete and re-issue instead.
 */
export async function deleteCredential(credentialId: string, userId: string): Promise<void> {
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  if (!credential) throw new Error('CREDENTIAL_NOT_FOUND');
  await prisma.credential.delete({ where: { id: credentialId } });
}

/**
 * Return all shares across all credentials for a user, enriched with
 * credential context (label, type). Used by the global Shares page.
 */
export async function getAllShares(userId: string) {
  const credentials = await prisma.credential.findMany({
    where: { userId },
    select: {
      id: true,
      credentialLabel: true,
      credentialType: true,
      shares: {
        select: {
          id: true,
          disclosedFields: true,
          expiresAt: true,
          createdAt: true,
          accessCount: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return credentials
    .flatMap((c) =>
      c.shares.map((s) => ({
        ...s,
        credentialId: c.id,
        credentialLabel: c.credentialLabel,
        credentialType: c.credentialType,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
