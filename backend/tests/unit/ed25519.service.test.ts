import {
  generateEd25519KeyPair,
  signMerkleRoot,
  verifyMerkleSignature,
} from '../../src/services/crypto/ed25519.service';
import { buildMerkleTree } from '../../src/services/merkle/merkle.service';

describe('Ed25519Service', () => {
  let privateKey: string;
  let publicKey: string;
  let merkleRoot: string;

  beforeAll(() => {
    const keypair = generateEd25519KeyPair();
    privateKey = keypair.privateKey;
    publicKey = keypair.publicKey;

    const { root } = buildMerkleTree({
      name: 'Test User',
      degree: 'B.Tech',
      cgpa: 9.0,
    });
    merkleRoot = root;
  });

  describe('generateEd25519KeyPair', () => {
    it('should generate a keypair with non-empty keys', () => {
      const kp = generateEd25519KeyPair();
      expect(kp.privateKey).toBeTruthy();
      expect(kp.publicKey).toBeTruthy();
    });

    it('should generate different keypairs each call', () => {
      const kp1 = generateEd25519KeyPair();
      const kp2 = generateEd25519KeyPair();
      expect(kp1.privateKey).not.toBe(kp2.privateKey);
      expect(kp1.publicKey).not.toBe(kp2.publicKey);
    });

    it('should produce base64-encoded strings', () => {
      const kp = generateEd25519KeyPair();
      expect(() => Buffer.from(kp.privateKey, 'base64')).not.toThrow();
      expect(() => Buffer.from(kp.publicKey, 'base64')).not.toThrow();
    });
  });

  describe('signMerkleRoot + verifyMerkleSignature', () => {
    it('should produce a valid signature that verifies correctly', () => {
      const signature = signMerkleRoot(merkleRoot, privateKey);
      const valid = verifyMerkleSignature(merkleRoot, signature, publicKey);
      expect(valid).toBe(true);
    });

    it('should fail verification with a different root (tamper detection)', () => {
      const signature = signMerkleRoot(merkleRoot, privateKey);
      const tamperedRoot = 'b'.repeat(64);
      const valid = verifyMerkleSignature(tamperedRoot, signature, publicKey);
      expect(valid).toBe(false);
    });

    it('should fail verification with a different public key', () => {
      const signature = signMerkleRoot(merkleRoot, privateKey);
      const { publicKey: otherPublicKey } = generateEd25519KeyPair();
      const valid = verifyMerkleSignature(merkleRoot, signature, otherPublicKey);
      expect(valid).toBe(false);
    });

    it('should fail verification with a tampered signature', () => {
      const signature = signMerkleRoot(merkleRoot, privateKey);
      // Flip a byte in the signature
      const sigBuffer = Buffer.from(signature, 'base64');
      sigBuffer[0] = sigBuffer[0] ^ 0xff;
      const tamperedSig = sigBuffer.toString('base64');
      const valid = verifyMerkleSignature(merkleRoot, tamperedSig, publicKey);
      expect(valid).toBe(false);
    });

    it('should handle invalid base64 gracefully (return false)', () => {
      const valid = verifyMerkleSignature(merkleRoot, 'not-valid-base64!!!', publicKey);
      expect(valid).toBe(false);
    });
  });
});
