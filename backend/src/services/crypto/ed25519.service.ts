import {
  generateKeyPairSync,
  sign,
  verify,
  createPrivateKey,
  createPublicKey,
  KeyObject,
} from 'crypto';

/**
 * Generate a new Ed25519 keypair.
 * Returns base64url-encoded DER representations.
 */
export function generateEd25519KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

/**
 * Load private key from base64-encoded DER (PKCS8).
 */
function loadPrivateKey(base64: string): KeyObject {
  const der = Buffer.from(base64, 'base64');
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

/**
 * Load public key from base64-encoded DER (SPKI).
 */
function loadPublicKey(base64: string): KeyObject {
  const der = Buffer.from(base64, 'base64');
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Sign a hex-encoded root hash with the issuer Ed25519 private key.
 * Returns base64url-encoded signature.
 */
export function signMerkleRoot(rootHex: string, privateKeyBase64: string): string {
  const privateKey = loadPrivateKey(privateKeyBase64);
  const data = Buffer.from(rootHex, 'hex');
  const signature = sign(null, data, privateKey);
  return signature.toString('base64');
}

/**
 * Verify an Ed25519 signature over a hex-encoded root hash.
 */
export function verifyMerkleSignature(
  rootHex: string,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const publicKey = loadPublicKey(publicKeyBase64);
    const data = Buffer.from(rootHex, 'hex');
    const signature = Buffer.from(signatureBase64, 'base64');
    return verify(null, data, publicKey, signature);
  } catch {
    return false;
  }
}
