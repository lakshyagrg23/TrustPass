import { verifyPresentationJwt } from '../../services/jwt/jwt.service';
import { verifyProof } from '../../services/merkle/merkle.service';
import { verifyMerkleSignature } from '../../services/crypto/ed25519.service';
import type {
  VerificationResult,
  FieldVerificationResult,
  VerifiablePresentation,
} from '../../types';

/**
 * Verify a Verifiable Presentation token.
 *
 * Performs 4 layered checks:
 * 1. JWT signature validity (transport integrity)
 * 2. Expiration check
 * 3. Per-field Merkle proof verification
 * 4. Issuer Ed25519 signature over Merkle root
 */
export async function verifyPresentation(presentationToken: string): Promise<VerificationResult> {
  let vp: VerifiablePresentation;

  // ── Check 1: JWT transport signature ──────────────────────────────────────
  let jwtSignatureValid = false;
  let notExpired = false;

  try {
    vp = verifyPresentationJwt(presentationToken);
    jwtSignatureValid = true;
    notExpired = new Date(vp.expiresAt) > new Date();
  } catch (err: unknown) {
    const isExpired =
      err instanceof Error && err.message?.toLowerCase().includes('expired');

    return {
      verified: false,
      credentialId: 'unknown',
      issuerName: 'unknown',
      issuedAt: 'unknown',
      expiresAt: 'unknown',
      disclosedClaims: {},
      fieldResults: [],
      checks: {
        jwtSignatureValid: false,
        notExpired: !isExpired,
        merkleProofsValid: false,
        issuerSignatureValid: false,
      },
      failureReason: isExpired
        ? 'Presentation has expired'
        : 'Presentation token is invalid or tampered',
    };
  }

  if (!notExpired) {
    return {
      verified: false,
      credentialId: vp!.credentialId,
      issuerName: vp!.issuerName,
      issuedAt: vp!.issuedAt,
      expiresAt: vp!.expiresAt,
      disclosedClaims: vp!.disclosedClaims,
      fieldResults: [],
      checks: {
        jwtSignatureValid: true,
        notExpired: false,
        merkleProofsValid: false,
        issuerSignatureValid: false,
      },
      failureReason: 'Share link has expired',
    };
  }

  // ── Check 2: Per-field Merkle proof verification ───────────────────────────
  const fieldResults: FieldVerificationResult[] = [];
  let allMerkleProofsValid = true;

  for (const [field, value] of Object.entries(vp.disclosedClaims)) {
    const fieldProof = vp.merkleProofs[field];

    if (!fieldProof) {
      fieldResults.push({
        field,
        value,
        merkleProofValid: false,
        status: 'invalid',
      });
      allMerkleProofsValid = false;
      continue;
    }

    // verifyProof uses the embedded salt to recompute SHA256(0x00 || salt || "field:value")
    // then walks the sibling path — hidden fields' salts were never included, so
    // an adversary cannot brute-force sibling hashes from the proof
    const proofValid = verifyProof(field, value, fieldProof, vp.merkleRoot);
    fieldResults.push({
      field,
      value,
      merkleProofValid: proofValid,
      status: proofValid ? 'verified' : 'tampered',
    });

    if (!proofValid) allMerkleProofsValid = false;
  }


  // ── Check 3: Issuer Ed25519 signature over Merkle root ────────────────────
  const issuerSignatureValid = verifyMerkleSignature(
    vp.merkleRoot,
    vp.issuerSignature,
    vp.issuerPublicKey,
  );

  // ── Final verdict ──────────────────────────────────────────────────────────
  const verified = jwtSignatureValid && notExpired && allMerkleProofsValid && issuerSignatureValid;

  let failureReason: string | undefined;
  if (!verified) {
    if (!allMerkleProofsValid) {
      failureReason = 'One or more Merkle proofs are invalid — data may have been tampered';
    } else if (!issuerSignatureValid) {
      failureReason = 'Issuer signature is invalid — credential authenticity cannot be confirmed';
    }
  }

  return {
    verified,
    credentialId: vp.credentialId,
    issuerName: vp.issuerName,
    issuedAt: vp.issuedAt,
    expiresAt: vp.expiresAt,
    disclosedClaims: vp.disclosedClaims,
    fieldResults,
    checks: {
      jwtSignatureValid,
      notExpired,
      merkleProofsValid: allMerkleProofsValid,
      issuerSignatureValid,
    },
    ...(failureReason && { failureReason }),
  };
}
