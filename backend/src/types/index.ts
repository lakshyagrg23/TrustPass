// ─── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthPayload {
  userId: string;
  email: string;
}

// ─── Claims ───────────────────────────────────────────────────────────────────
/**
 * Flat credential claims: any combination of string, number, boolean values.
 * Nested objects are disallowed to ensure deterministic canonicalization.
 */
export type ClaimValue = string | number | boolean;
export type RawClaims = Record<string, ClaimValue>;
export type ClaimHashes = Record<string, string>;

/**
 * Per-field random 32-byte salts (hex-encoded).
 * Stored encrypted in DB alongside claims.
 * NEVER included in proofs for hidden fields — without the salt,
 * brute-forcing the sibling hash is computationally infeasible (2^256).
 */
export type ClaimSalts = Record<string, string>; // fieldName → 32-byte hex salt

// ─── Merkle ───────────────────────────────────────────────────────────────────
export interface MerkleProofStep {
  position: 'left' | 'right';
  data: string; // hex
}

/**
 * Per-field proof envelope.
 *
 * The `salt` is the 32-byte random value used at issuance to blind the leaf hash.
 * Including it here lets verifiers recompute SHA256(0x00 || salt || "field:value")
 * for only the fields that were disclosed. Hidden fields' salts are never sent,
 * making brute-force of sibling hashes computationally infeasible.
 */
export interface FieldProof {
  salt: string;             // hex-encoded 32-byte blinding factor
  proof: MerkleProofStep[]; // Merkle sibling path to root
}

export type MerkleProofs = Record<string, FieldProof>;

// ─── Verifiable Presentation ──────────────────────────────────────────────────
export interface VerifiablePresentation {
  credentialId: string;
  disclosedClaims: Record<string, unknown>;
  merkleProofs: MerkleProofs;
  merkleRoot: string;
  issuerSignature: string;
  issuerPublicKey: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string;
}

// ─── Verification Result ──────────────────────────────────────────────────────
export interface FieldVerificationResult {
  field: string;
  value: unknown;
  merkleProofValid: boolean;
  status: 'verified' | 'invalid' | 'tampered';
}

export interface VerificationResult {
  verified: boolean;
  credentialId: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string;
  disclosedClaims: Record<string, unknown>;
  merkleRoot: string;
  issuerPublicKey: string;
  issuerSignature: string;
  fieldResults: FieldVerificationResult[];
  checks: {
    jwtSignatureValid: boolean;
    notExpired: boolean;
    merkleProofsValid: boolean;
    issuerSignatureValid: boolean;
  };
  failureReason?: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
