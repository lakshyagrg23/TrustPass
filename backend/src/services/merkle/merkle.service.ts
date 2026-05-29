import { MerkleTree } from 'merkletreejs';
import { createHash, randomBytes } from 'crypto';
import type { MerkleProofStep, MerkleProofs, ClaimSalts, FieldProof } from '../../types';

// ── Domain separation prefixes (RFC-compliant Merkle hardening) ────────────────
// Prevents second-preimage attacks where an attacker submits an internal node's
// 64-byte hash as a leaf to trick a verifier.
//   0x00 prefix → leaf node hashing
//   0x01 prefix → internal node hashing
const LEAF_PREFIX = Buffer.from([0x00]);
const INTERNAL_PREFIX = Buffer.from([0x01]);

// ── Internal node hasher (passed to MerkleTree) ───────────────────────────────
// merkletreejs calls this for every pair of children when building/verifying.
// Adding 0x01 ensures internal hashes can never equal leaf hashes by construction.
function internalNodeHash(data: Buffer): Buffer {
  return createHash('sha256')
    .update(Buffer.concat([INTERNAL_PREFIX, data]))
    .digest();
}

// ── Canonicalization ─────────────────────────────────────────────────────────
/**
 * Convert a claim value to a canonical UTF-8 string.
 *
 * Rules (explicitly typed to avoid JSON.stringify surprises):
 *   string  → the value itself (no extra JSON quotes)
 *   number  → JSON.stringify — handles integers, floats, -0 correctly
 *   boolean → "true" | "false"
 *   other   → String(value) as fallback
 *
 * Format: "fieldName:canonicalValue"
 * Example: "cgpa:9.31", "degree:B.Tech CSE", "active:true"
 */
export function normalizeClaim(key: string, value: unknown): string {
  let canonical: string;
  if (typeof value === 'string') {
    canonical = value;                 // no wrapping quotes — unambiguous for strings
  } else if (typeof value === 'number') {
    canonical = JSON.stringify(value); // handles 9.31, 2027, -0, Infinity correctly
  } else if (typeof value === 'boolean') {
    canonical = value ? 'true' : 'false';
  } else {
    canonical = String(value);
  }
  return `${key}:${canonical}`;
}

// ── Salted leaf hashing ───────────────────────────────────────────────────────
/**
 * Compute the salted, domain-separated leaf hash for a single claim.
 *
 *   leaf = SHA256( 0x00 || salt || "fieldName:canonicalValue" )
 *
 * The random 32-byte `salt` is generated once at issuance and stored in the DB.
 * Without the salt, an attacker who sees a sibling hash in a proof cannot
 * brute-force low-entropy values (CGPA 0–10, grade A/B/C, year 2020–2030).
 * The search space expands from ~100 guesses to 2^256.
 *
 * @param key   - Credential field name (e.g. "cgpa")
 * @param value - Raw claim value
 * @param salt  - 32-byte random Buffer generated at issuance
 */
export function computeLeafHash(key: string, value: unknown, salt: Buffer): Buffer {
  const normalized = Buffer.from(normalizeClaim(key, value), 'utf8');
  return createHash('sha256')
    .update(Buffer.concat([LEAF_PREFIX, salt, normalized]))
    .digest();
}

// ── Salt generation ───────────────────────────────────────────────────────────
/**
 * Generate one cryptographically random 32-byte salt per claim field.
 * Returns hex-encoded strings for DB storage.
 */
export function generateClaimSalts(claims: Record<string, unknown>): ClaimSalts {
  const salts: ClaimSalts = {};
  for (const key of Object.keys(claims)) {
    salts[key] = randomBytes(32).toString('hex');
  }
  return salts;
}

// ── Merkle tree construction ──────────────────────────────────────────────────
/**
 * Build a salted, domain-separated Merkle tree from a claims object.
 *
 * Security properties:
 * 1. Salted leaves   — brute-force of sibling hashes is infeasible
 * 2. Domain separation (0x00/0x01) — no second-preimage attacks
 * 3. sortPairs: true — tree root is order-independent (deterministic)
 * 4. Sorted keys     — deterministic leaf ordering across runtimes
 *
 * @param claims - Full credential claims map
 * @param salts  - Per-field 32-byte hex salts (from DB or freshly generated)
 */
export function buildMerkleTree(
  claims: Record<string, unknown>,
  salts: ClaimSalts,
): {
  tree: MerkleTree;
  leaves: Buffer[];
  leafMap: Record<string, Buffer>; // fieldName → leaf Buffer
  root: string;
} {
  const sortedKeys = Object.keys(claims).sort();

  const leafMap: Record<string, Buffer> = {};
  const leaves: Buffer[] = sortedKeys.map((key) => {
    const saltHex = salts[key];
    if (!saltHex) {
      // Legacy credential issued before per-field salts were introduced.
      // Cannot generate cryptographically valid proofs without a salt.
      throw new Error(`LEGACY_CREDENTIAL:${key}`);
    }
    const salt = Buffer.from(saltHex, 'hex');
    const leaf = computeLeafHash(key, claims[key], salt);
    leafMap[key] = leaf;
    return leaf;
  });

  // hashLeaves: false — leaves are already hashed by computeLeafHash (with 0x00 prefix)
  // internalNodeHash — adds 0x01 prefix to all internal nodes
  const tree = new MerkleTree(leaves, internalNodeHash, {
    sortPairs: true,
    hashLeaves: false,
  });
  const root = tree.getRoot().toString('hex');

  return { tree, leaves, leafMap, root };
}

// ── Proof generation ──────────────────────────────────────────────────────────
/**
 * Generate Merkle proofs (with salts) for a subset of disclosed fields.
 *
 * The salt for each disclosed field is included so the verifier can
 * recompute the leaf hash independently. Salts for hidden fields are
 * never included — this is what provides the brute-force resistance.
 */
export function generateProofs(
  tree: MerkleTree,
  leafMap: Record<string, Buffer>,
  salts: ClaimSalts,
  fields: string[],
): MerkleProofs {
  const proofs: MerkleProofs = {};

  for (const field of fields) {
    const leaf = leafMap[field];
    if (!leaf) {
      throw new Error(`Field "${field}" not found in credential claims`);
    }

    const rawProof = tree.getProof(leaf);
    const proof: MerkleProofStep[] = rawProof.map((step: { position: string; data: Buffer }) => ({
      position: step.position as 'left' | 'right',
      data: step.data.toString('hex'),
    }));

    const fieldProof: FieldProof = {
      salt: salts[field], // ← disclosed field's salt ONLY
      proof,
    };

    proofs[field] = fieldProof;
  }

  return proofs;
}

// ── Proof verification ────────────────────────────────────────────────────────
/**
 * Verify a Merkle proof for a single disclosed field.
 *
 * Recomputes: leaf = SHA256(0x00 || salt || "field:value")
 * Then walks the proof path up to the root using the same internal node hash.
 *
 * @param field   - Claim field name
 * @param value   - Claimed value (from VP disclosedClaims)
 * @param proof   - FieldProof envelope (includes salt + sibling path)
 * @param rootHex - Expected Merkle root from the original credential
 */
export function verifyProof(
  field: string,
  value: unknown,
  proof: FieldProof,
  rootHex: string,
): boolean {
  try {
    const salt = Buffer.from(proof.salt, 'hex');
    const leaf = computeLeafHash(field, value, salt);
    const rootBuffer = Buffer.from(rootHex, 'hex');

    const merkleProof = proof.proof.map((step) => ({
      position: step.position,
      data: Buffer.from(step.data, 'hex'),
    }));

    // Reconstruct a tree with the same hash config to use its verify() method
    const tempTree = new MerkleTree([], internalNodeHash, {
      sortPairs: true,
      hashLeaves: false,
    });
    return tempTree.verify(merkleProof, leaf, rootBuffer);
  } catch {
    return false;
  }
}

// ── Claim hash index (for DB storage / auditing) ─────────────────────────────
/**
 * Build a map of fieldName → unsalted SHA-256 hex for the claimHashes DB column.
 * This is used only for listing available fields — NOT for Merkle proof verification.
 *
 * Note: the actual Merkle leaves use salted hashes. This separate index
 * lets the system enumerate fields without exposing the Merkle leaf values.
 */
export function buildClaimHashes(claims: Record<string, unknown>): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const [key, value] of Object.entries(claims)) {
    hashes[key] = createHash('sha256')
      .update(normalizeClaim(key, value))
      .digest('hex');
  }
  return hashes;
}

// ── Legacy helpers (kept for compatibility) ───────────────────────────────────
export function sha256Buffer(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

export function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
