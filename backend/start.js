#!/usr/bin/env node
/**
 * Startup script for Docker that generates keys if missing
 * IMPORTANT: Keys are only auto-generated in development mode
 * Production deployments MUST have explicit crypto keys set
 */

const { generateEd25519KeyPair } = require('./dist/services/crypto/ed25519.service');
const { randomBytes } = require('crypto');
const { execSync } = require('child_process');

const isDev = process.env.NODE_ENV !== 'production';

// Check if keys are already set and valid
const jwtSecret = process.env.JWT_SECRET || '';
const encryptionKey = process.env.ENCRYPTION_KEY || '';
const issuerPrivateKey = process.env.ISSUER_PRIVATE_KEY || '';
const issuerPublicKey = process.env.ISSUER_PUBLIC_KEY || '';

const keysValid = jwtSecret.length >= 32 && encryptionKey.trim().length === 32 && issuerPrivateKey.length >= 1 && issuerPublicKey.length >= 1;

if (!keysValid) {
  if (!isDev) {
    console.error('❌ Production deployment missing crypto keys!');
    console.error('Set JWT_SECRET, ENCRYPTION_KEY, ISSUER_PRIVATE_KEY, ISSUER_PUBLIC_KEY in production environment.');
    process.exit(1);
  }
  
  console.log('🔑 Generating cryptographic keys (development mode)...');
  
  const { privateKey, publicKey } = generateEd25519KeyPair();
  // Generate 24 bytes -> 32 character base64 string
  const newEncryptionKey = randomBytes(24).toString('base64');
  const newJwtSecret = randomBytes(48).toString('hex');
  
  // Set environment variables for this process
  process.env.JWT_SECRET = newJwtSecret;
  process.env.ENCRYPTION_KEY = newEncryptionKey;
  process.env.ISSUER_PRIVATE_KEY = privateKey;
  process.env.ISSUER_PUBLIC_KEY = publicKey;
  
  console.log('✅ Keys generated successfully');
}

// Setup database
console.log('📦 Setting up database...');
try {
  execSync('npm run db:push', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Database setup failed');
  process.exit(1);
}

// Start the server
console.log('🚀 Starting TrustPass backend...');
require('./dist/index.js');
