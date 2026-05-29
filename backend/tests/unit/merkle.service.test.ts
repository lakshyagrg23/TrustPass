import {
  buildMerkleTree,
  generateProofs,
  verifyProof,
  buildClaimHashes,
  hashClaim,
} from '../../src/services/merkle/merkle.service';

const sampleClaims = {
  name: 'Lakshya Garg',
  degree: 'B.Tech CSE',
  graduationYear: 2027,
  cgpa: 9.31,
  marks: 'A',
  issuerName: 'IIIT Naya Raipur',
  issueDate: '2024-01-15',
};

describe('MerkleService', () => {
  let treeData: ReturnType<typeof buildMerkleTree>;

  beforeAll(() => {
    treeData = buildMerkleTree(sampleClaims);
  });

  describe('buildMerkleTree', () => {
    it('should build a tree with a non-empty root', () => {
      expect(treeData.root).toBeTruthy();
      expect(treeData.root.length).toBe(64); // 32-byte hex
    });

    it('should produce the same root from the same claims (deterministic)', () => {
      const { root: root2 } = buildMerkleTree(sampleClaims);
      expect(treeData.root).toBe(root2);
    });

    it('should produce a different root if any claim is modified', () => {
      const modifiedClaims = { ...sampleClaims, cgpa: 9.99 };
      const { root: rootModified } = buildMerkleTree(modifiedClaims);
      expect(treeData.root).not.toBe(rootModified);
    });

    it('should create leaf map with one entry per field', () => {
      expect(Object.keys(treeData.leafMap)).toHaveLength(Object.keys(sampleClaims).length);
    });
  });

  describe('generateProofs', () => {
    it('should generate proof for a single field', () => {
      const proofs = generateProofs(treeData.tree, treeData.leafMap, ['degree']);
      expect(proofs.degree).toBeDefined();
      expect(Array.isArray(proofs.degree)).toBe(true);
    });

    it('should generate proofs for multiple fields', () => {
      const proofs = generateProofs(treeData.tree, treeData.leafMap, [
        'degree',
        'graduationYear',
      ]);
      expect(proofs.degree).toBeDefined();
      expect(proofs.graduationYear).toBeDefined();
      expect(proofs.cgpa).toBeUndefined(); // hidden field has no proof
    });

    it('should throw for non-existent field', () => {
      expect(() =>
        generateProofs(treeData.tree, treeData.leafMap, ['nonExistentField']),
      ).toThrow('nonExistentField');
    });
  });

  describe('verifyProof', () => {
    it('should verify a valid proof', () => {
      const proofs = generateProofs(treeData.tree, treeData.leafMap, ['degree']);
      const valid = verifyProof('degree', 'B.Tech CSE', proofs.degree, treeData.root);
      expect(valid).toBe(true);
    });

    it('should reject a tampered claim value', () => {
      const proofs = generateProofs(treeData.tree, treeData.leafMap, ['degree']);
      // Tamper the value
      const valid = verifyProof('degree', 'B.Tech IT', proofs.degree, treeData.root);
      expect(valid).toBe(false);
    });

    it('should reject a tampered field name', () => {
      const proofs = generateProofs(treeData.tree, treeData.leafMap, ['degree']);
      const valid = verifyProof('major', 'B.Tech CSE', proofs.degree, treeData.root);
      expect(valid).toBe(false);
    });

    it('should reject proof against wrong root', () => {
      const proofs = generateProofs(treeData.tree, treeData.leafMap, ['degree']);
      const wrongRoot = 'a'.repeat(64);
      const valid = verifyProof('degree', 'B.Tech CSE', proofs.degree, wrongRoot);
      expect(valid).toBe(false);
    });

    it('should verify all disclosed fields independently', () => {
      const fields = ['degree', 'graduationYear', 'issuerName'];
      const proofs = generateProofs(treeData.tree, treeData.leafMap, fields);

      for (const field of fields) {
        const valid = verifyProof(
          field,
          sampleClaims[field as keyof typeof sampleClaims],
          proofs[field],
          treeData.root,
        );
        expect(valid).toBe(true);
      }
    });

    it('should NOT allow a hidden field to be proven with another field\'s proof', () => {
      // Try to prove cgpa using degree's proof (cross-field attack)
      const proofs = generateProofs(treeData.tree, treeData.leafMap, ['degree']);
      const valid = verifyProof('cgpa', 9.31, proofs.degree, treeData.root);
      expect(valid).toBe(false);
    });
  });

  describe('buildClaimHashes', () => {
    it('should build one hash per claim', () => {
      const hashes = buildClaimHashes(sampleClaims);
      expect(Object.keys(hashes)).toHaveLength(Object.keys(sampleClaims).length);
    });

    it('should produce hex strings of length 64', () => {
      const hashes = buildClaimHashes(sampleClaims);
      for (const hash of Object.values(hashes)) {
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('hashClaim should be deterministic', () => {
      expect(hashClaim('degree', 'B.Tech CSE')).toBe(hashClaim('degree', 'B.Tech CSE'));
    });

    it('hashClaim should differ for different values', () => {
      expect(hashClaim('degree', 'B.Tech CSE')).not.toBe(hashClaim('degree', 'M.Tech CSE'));
    });
  });
});
