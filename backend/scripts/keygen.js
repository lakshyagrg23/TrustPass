#!/usr/bin/env node
"use strict";
/**
 * One-time key generation script for TrustPass.
 * Run: npx ts-node scripts/keygen.ts
 * Copy the output into your .env file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ed25519_service_1 = require("../src/services/crypto/ed25519.service");
const crypto_1 = require("crypto");
const { privateKey, publicKey } = (0, ed25519_service_1.generateEd25519KeyPair)();
const encryptionKey = (0, crypto_1.randomBytes)(32).toString('base64');
const jwtSecret = (0, crypto_1.randomBytes)(48).toString('hex');
console.log('\n🔑 TrustPass Key Generation\n');
console.log('Copy these into your .env file:\n');
console.log(`ISSUER_PRIVATE_KEY="${privateKey}"`);
console.log(`ISSUER_PUBLIC_KEY="${publicKey}"`);
console.log(`ENCRYPTION_KEY="${encryptionKey.slice(0, 32)}"`);
console.log(`JWT_SECRET="${jwtSecret}"`);
console.log('\n⚠️  Keep ISSUER_PRIVATE_KEY secret. Never commit it to version control.\n');
//# sourceMappingURL=keygen.js.map