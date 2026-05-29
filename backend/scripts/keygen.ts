#!/usr/bin/env node
/**
 * One-time key generation script for TrustPass.
 * Run: npx ts-node scripts/keygen.ts
 * Copy the output into your .env file.
 */

import { generateEd25519KeyPair } from '../src/services/crypto/ed25519.service';
import { randomBytes } from 'crypto';

const { privateKey, publicKey } = generateEd25519KeyPair();
const encryptionKey = randomBytes(32).toString('base64');
const jwtSecret = randomBytes(48).toString('hex');

console.log('\n🔑 TrustPass Key Generation\n');
console.log('Copy these into your .env file:\n');
console.log(`ISSUER_PRIVATE_KEY="${privateKey}"`);
console.log(`ISSUER_PUBLIC_KEY="${publicKey}"`);
console.log(`ENCRYPTION_KEY="${encryptionKey.slice(0, 32)}"`);
console.log(`JWT_SECRET="${jwtSecret}"`);
console.log('\n⚠️  Keep ISSUER_PRIVATE_KEY secret. Never commit it to version control.\n');
