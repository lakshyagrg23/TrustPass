#!/bin/sh
# Backend startup script that generates keys if they don't exist

# Check if crypto keys are properly set (expect at least 32 chars)
if [ ${#JWT_SECRET} -lt 32 ] 2>/dev/null || [ -z "$JWT_SECRET" ]; then
  echo "🔑 Generating cryptographic keys..."
  
  # Use Node.js directly to generate and export keys
  export $(node -e "
    const { generateEd25519KeyPair } = require('./dist/services/crypto/ed25519.service');
    const { randomBytes } = require('crypto');
    const { privateKey, publicKey } = generateEd25519KeyPair();
    const encryptionKey = randomBytes(32).toString('hex');
    const jwtSecret = randomBytes(48).toString('hex');
    
    console.log('JWT_SECRET=' + jwtSecret);
    console.log('ENCRYPTION_KEY=' + encryptionKey);
    console.log('ISSUER_PRIVATE_KEY=' + privateKey);
    console.log('ISSUER_PUBLIC_KEY=' + publicKey);
  ")
  
  echo "✅ Keys generated successfully"
fi

# Run database migrations
echo "📦 Setting up database..."
npm run db:push

# Start the server
echo "🚀 Starting TrustPass backend..."
npm start
