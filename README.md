# TrustPass — Verifiable Credentials & Selective Disclosure

<div align="center">

**A production-grade digital identity system implementing Merkle-tree based selective disclosure with Ed25519 signatures.**

Holders can share **only specific fields** of their credentials while verifiers can **cryptographically confirm authenticity** — without seeing hidden data.

[Features](#features) • [Architecture](#architecture) • [Setup](#setup) • [API](#api-documentation) • [Deployment](#deployment) • [Improvements](#what-could-be-improved)

</div>

---

## 🎯 Problem Statement

Digital identity verification today faces a fundamental privacy-security tradeoff:

- **Traditional approach**: Share entire credential → Verifier sees everything (privacy loss)
- **Verification challenge**: How to prove "I have degree X" without exposing CGPA, SSN, marks?

**TrustPass solves this** with **selective disclosure** — cryptographic proof that specific fields are authentic, without revealing the rest.

---

## ✨ Features

### Holder (Credential Owner)
- ✅ Modern dashboard with JWT-based authentication
- ✅ Issue credentials with multiple claims (name, degree, CGPA, marks, etc.)
- ✅ **Selective field disclosure** — choose which fields to share
- ✅ Generate verifiable, time-limited share links
- ✅ QR code generation for one-tap sharing
- ✅ Access tracking (see who verified your credentials)
- ✅ Mobile-first responsive design

### Verifier (Credential Recipient)
- ✅ Public verification page (no login required)
- ✅ Clear verification status with detailed trust indicators
- ✅ See ONLY the fields holder chose to share
- ✅ Cryptographic proof of authenticity
- ✅ View issuer details, issue date, expiration
- ✅ Access from any device (desktop, mobile)

### Backend Security
- ✅ **Merkle-tree selective disclosure** — production-grade cryptography
- ✅ Ed25519 signatures for issuer authenticity
- ✅ AES-256-GCM encryption of claims at rest
- ✅ Per-field random salts preventing brute-force attacks
- ✅ JWT with expiry enforcement
- ✅ Rate limiting on verification endpoints
- ✅ Input validation & sanitization (Zod)
- ✅ Comprehensive error handling

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         TRUSTPASS                            │
├─────────────────┬────────────────────┬───────────────────────┤
│  HOLDER         │   BACKEND/ISSUER   │   VERIFIER            │
│  (Frontend)     │   (Node.js/Express)│   (Public UI)         │
│                 │                    │                       │
│ ┌─────────────┐ │ ┌──────────────────┐│ ┌─────────────────┐ │
│ │  Register   │ │ │ Ed25519 Keypair  ││ │  Scan QR Code   │ │
│ │  Login      │─┼─│ Generate Salts   │├─│  Or Paste Link  │ │
│ │ Issue Cred  │ │ │ Build Merkle Tree ││ │                 │ │
│ │             │ │ │ Sign Root Hash   ││ │ Fetch Share Link│ │
│ │ Select Fields│ │ │ Encrypt Claims   ││ │ Verify Crypto   │ │
│ │ Share Link  │ │ │ Generate VP      ││ │ Trust Indicators│ │
│ │ Generate QR │─┼─│ Create JWT Token ││─│ Show Results    │ │
│ └─────────────┘ │ └──────────────────┘│ └─────────────────┘ │
│                 │                    │                       │
└─────────────────┴────────────────────┴───────────────────────┘

           Database (PostgreSQL)
           ├─ User credentials (encrypted)
           ├─ Merkle roots + signatures
           ├─ Share records (tracking)
           └─ Access logs (analytics)
```

---

## 🔐 Selective Disclosure Deep-Dive

### How It Works (3-Layer Cryptography)

**Layer 1: Credential Issuance**
```
Raw Claims: { name: "Alice", degree: "B.Tech", cgpa: 9.31, marks: 95 }
              ↓
Per-field salting: SHA256(0x00 || 32-byte-random-salt || "field:value")
              ↓
Merkle tree construction (SHA256, sortPairs: true)
              ↓
Root hash → Ed25519 signature (issuer private key)
              ↓
Storage: { encryptedClaims, merkleRoot, issuerSignature, claimSalts }
```

**Layer 2: Selective Sharing**
```
Holder selects: ["degree", "marks"]
              ↓
Backend decrypts all claims (server-side only)
              ↓
Rebuild Merkle tree deterministically (same salts, sorted keys)
              ↓
Generate proof paths for ONLY selected fields
              ↓
Build Verifiable Presentation (VP):
  {
    disclosedClaims: { degree: "B.Tech", marks: 95 },
    merkleProofs: {
      degree: { salt: "...", proof: [...] },
      marks: { salt: "...", proof: [...] }
    },
    merkleRoot: "...",
    issuerSignature: "...",
    issuerPublicKey: "...",
    expiresAt: "2026-05-30T10:00:00Z"
  }
              ↓
Sign as JWT → Presentation Token (transport integrity)
              ↓
Hidden fields' salts NEVER included → Brute-force search space = 2^256
```

**Layer 3: Verification**
```
Verifier receives presentationToken
              ↓
Check 1: JWT signature valid? (transport integrity)
  ✅ Yes → Token came from TrustPass server, not tampered
  ❌ No → INVALID

              ↓
Check 2: Not expired? (expiresAt < now)
  ✅ Yes → Token still valid
  ❌ No → EXPIRED

              ↓
Check 3: For EACH disclosed field:
  1. Recompute leaf: SHA256(0x00 || salt || "field:value")
  2. Walk Merkle proof path up to root
  3. Must match stored merkleRoot
  ✅ All match → Fields are authentic
  ❌ Any fail → TAMPERED

              ↓
Check 4: Ed25519 signature over merkleRoot valid?
  ✅ Yes → Credential authentically issued by issuer
  ❌ No → FORGED

              ↓
Final Result: VERIFIED ✅ or INVALID ❌ with specific failure reason
```

### Why This Design is Secure

| Threat | Mitigation |
|--------|-----------|
| Attacker forges a credential | Ed25519 signature prevents (only issuer has private key) |
| Attacker modifies a disclosed field | Merkle proof will fail verification |
| Attacker tries to include a hidden field | Salt not included → Proof can't be computed |
| Attacker brute-forces sibling hashes | 32-byte random salt → 2^256 guesses needed |
| Attacker replays old token | JWT expiry + accessCount tracking |
| Man-in-the-middle intercepts | JWT signature detects tampering |

---

## 📊 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 16 + React 19 + TypeScript | Server-side rendering + API routes + type safety |
| | Tailwind CSS + Radix UI | Mobile-first, accessible components |
| **Backend** | Express 5 + TypeScript | Lightweight, fast, production-proven |
| | Prisma ORM | Type-safe DB queries, auto migrations |
| **Database** | PostgreSQL | ACID compliance, JSON support, proven reliability |
| **Cryptography** | Node `crypto` (native) | Ed25519, SHA-256, AES-256-GCM |
| | `merkletreejs` | Efficient Merkle tree operations |
| **Authentication** | JWT + bcrypt | Stateless auth, secure password hashing |
| **Validation** | Zod | Runtime type validation |
| **QR Codes** | `qrcode` | Share link encoding |
| **Security** | Helmet + rate-limit | HTTP headers + brute-force protection |
| **Documentation** | Swagger/OpenAPI | Auto-generated interactive API docs |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ & npm 9+
- PostgreSQL 14+
- Docker & Docker Compose (optional, recommended)

### Local Development Setup

**1. Clone Repository**
```bash
git clone https://github.com/cystar/trustpass.git
cd trustpass
```

**2. Environment Setup**

Generate cryptographic keys:
```bash
cd backend
npm install
npm run keygen
```

Copy output into `.env`:
```bash
# backend/.env
ISSUER_PRIVATE_KEY="..."
ISSUER_PUBLIC_KEY="..."
ENCRYPTION_KEY="..."
JWT_SECRET="..."
DATABASE_URL="postgresql://user:password@localhost:5432/trustpass"
NODE_ENV="development"
PORT=4000
FRONTEND_URL="http://localhost:3000"
```

**3. Database Setup**
```bash
cd backend
npm run db:migrate
npm run db:push
```

**4. Start Backend**
```bash
cd backend
npm run dev
# ✅ Server running on http://localhost:4000
# 📚 Swagger docs on http://localhost:4000/api/docs
```

**5. Start Frontend** (in new terminal)
```bash
cd frontend
npm install
npm run dev
# ✅ Frontend running on http://localhost:3000
```

**6. Access Application**
- **Holder Dashboard**: http://localhost:3000
- **API Documentation**: http://localhost:4000/api/docs
- **Verification Page**: http://localhost:3000/verify

---

## 🐳 Docker Deployment

**Using Docker Compose (Recommended)**

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database on port 5432
- Backend API on port 4000
- Frontend on port 3000

Check services:
```bash
docker-compose ps
docker-compose logs -f backend
```

---

## 📚 API Documentation

### Access Swagger UI
```
http://localhost:4000/api/docs
```

### Core Endpoints

#### Authentication
```
POST   /api/auth/register         Create account
POST   /api/auth/login            Get JWT token
```

#### Credential Management
```
POST   /api/credentials/issue     Issue new credential
GET    /api/credentials           List user's credentials
GET    /api/credentials/:id       Get credential details
DELETE /api/credentials/:id       Delete credential + shares
```

#### Selective Disclosure (Core Feature)
```
POST   /api/credentials/share     Create Verifiable Presentation
GET    /api/credentials/share/:shareId  Fetch share by ID
```

#### Verification
```
POST   /api/credentials/verify    Verify presentation token
GET    /api/credentials/shares    Fetch share by token
```

### Example: Issue Credential

**Request:**
```bash
curl -X POST http://localhost:4000/api/credentials/issue \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialType": "academic",
    "credentialLabel": "B.Tech Degree",
    "claims": {
      "name": "Alice",
      "degree": "B.Tech Computer Science",
      "graduationYear": 2027,
      "cgpa": 9.31,
      "marks": "95/100",
      "issuerName": "Indian Institute of Technology"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "credentialId": "550e8400-e29b-41d4-a716-446655440000",
    "credentialType": "academic",
    "credentialLabel": "B.Tech Degree",
    "issuerName": "Indian Institute of Technology",
    "merkleRoot": "7a2f4e1c9b3d5a8f2c1e6d3a9b7f4c1e9d5a2b8f3c7e1d4a9b5c2f8e3a1d6",
    "issuedAt": "2026-05-29T10:00:00Z",
    "availableFields": ["name", "degree", "graduationYear", "cgpa", "marks", "issuerName"],
    "message": "Credential issued and cryptographically signed"
  }
}
```

### Example: Create Verifiable Presentation (Selective Share)

**Request:**
```bash
curl -X POST http://localhost:4000/api/credentials/share \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialId": "550e8400-e29b-41d4-a716-446655440000",
    "disclosedFields": ["name", "degree", "graduationYear"],
    "expiresIn": "24h"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shareId": "abc-123-def-456",
    "presentationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "shareUrl": "http://localhost:3000/verify?shareId=abc-123-def-456",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAADh0l...",
    "disclosedFields": ["name", "degree", "graduationYear"],
    "expiresAt": "2026-05-30T10:00:00Z"
  }
}
```

### Example: Verify Presentation

**Request:**
```bash
curl -X POST http://localhost:4000/api/credentials/verify \
  -H "Content-Type: application/json" \
  -d '{
    "presentationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "credentialId": "550e8400-e29b-41d4-a716-446655440000",
    "issuerName": "Indian Institute of Technology",
    "issuedAt": "2026-05-29T10:00:00Z",
    "expiresAt": "2026-05-30T10:00:00Z",
    "disclosedClaims": {
      "name": "Alice",
      "degree": "B.Tech Computer Science",
      "graduationYear": 2027
    },
    "fieldResults": [
      {
        "field": "name",
        "value": "Alice",
        "merkleProofValid": true,
        "status": "verified"
      },
      {
        "field": "degree",
        "value": "B.Tech Computer Science",
        "merkleProofValid": true,
        "status": "verified"
      },
      {
        "field": "graduationYear",
        "value": 2027,
        "merkleProofValid": true,
        "status": "verified"
      }
    ],
    "checks": {
      "jwtSignatureValid": true,
      "notExpired": true,
      "merkleProofsValid": true,
      "issuerSignatureValid": true
    }
  }
}
```

**See more in [API Documentation](http://localhost:4000/api/docs) or [Postman Collection](./postman-collection.json)**

---

## 🧪 Testing

### Unit Tests
```bash
cd backend
npm run test                # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Manual Testing with Swagger
```
1. Open http://localhost:4000/api/docs
2. Register a new user (POST /api/auth/register)
3. Login to get JWT token (POST /api/auth/login)
4. Click "Authorize" button, paste token as "Bearer <token>"
5. Try issuing a credential (POST /api/credentials/issue)
6. Create a share (POST /api/credentials/share)
7. Verify the share (POST /api/credentials/verify)
```

---

## 🌐 Deployment

### Deployment Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Generate strong JWT_SECRET (48+ random bytes)
- [ ] Use managed PostgreSQL (AWS RDS, Heroku, Railway)
- [ ] Enable HTTPS on both backend and frontend
- [ ] Set CORS_ORIGIN to production domain
- [ ] Configure rate limiting for production traffic
- [ ] Set up monitoring & error logging (Sentry, LogRocket)
- [ ] Enable database backups & automated snapshots
- [ ] Test all cryptographic operations end-to-end

### Deploy to Railway.app (Recommended for Simplicity)

**1. Backend Deployment**
```bash
cd backend

# Initialize Railway project
railway login
railway init

# Set environment variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=<railway_postgres_url>
railway variables set JWT_SECRET=<strong_secret>
# ... other env vars

# Deploy
railway up
```

### Deploy to Vercel (Frontend)

**1. Frontend Deployment**
```bash
cd frontend

vercel --prod \
  --env NEXT_PUBLIC_API_URL=<backend_url> \
  --env NEXT_PUBLIC_ISSUER_PUBLIC_KEY=<public_key>
```

### Docker Registry Deployment

**Build & Push to Docker Hub**
```bash
docker build -f backend/Dockerfile -t <username>/trustpass-backend:latest ./backend
docker build -f frontend/Dockerfile -t <username>/trustpass-frontend:latest ./frontend

docker push <username>/trustpass-backend:latest
docker push <username>/trustpass-frontend:latest
```

**Deploy on AWS ECS, Google Cloud Run, or Azure Container Instances**

---

## 🔒 Security Considerations

### Data Protection
- ✅ **Encryption at rest**: All claims encrypted with AES-256-GCM
- ✅ **Encryption in transit**: HTTPS/TLS (enforced in production)
- ✅ **Key management**: Issuer private key never exposed, stored securely in `.env`
- ✅ **Salted hashing**: Per-field random 32-byte salts prevent dictionary attacks

### Authentication & Authorization
- ✅ **JWT with expiry**: 7-day auth tokens, 24h presentation tokens (configurable)
- ✅ **Bcrypt password hashing**: 10-round salted hashing
- ✅ **Rate limiting**: 10 verification attempts per minute per IP
- ✅ **CORS protection**: Allowlisted origins only

### Input Validation
- ✅ **Zod schemas**: Runtime type checking on all inputs
- ✅ **Field sanitization**: No SQL injection, XSS, or command injection possible
- ✅ **Claim limits**: Max 30 fields per credential, max 60-char field names

### Cryptographic Security
- ✅ **Ed25519**: Modern asymmetric signing (NIST-approved, quantum-resistant alternative available)
- ✅ **SHA-256**: Standard cryptographic hash (no deprecated MD5/SHA1)
- ✅ **Domain separation**: 0x00/0x01 prefixes prevent preimage attacks
- ✅ **Deterministic Merkle trees**: sortPairs=true prevents tree manipulation

### Infrastructure Security
- ✅ **Helmet.js**: Secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- ✅ **CORS restrictions**: Whitelisted domains only
- ✅ **Environment isolation**: Dev ≠ prod keys, separate databases
- ✅ **Error handling**: No stack traces leaked to clients in production

---

## 📊 Database Schema

```prisma
model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  name         String
  credentials  Credential[]
  createdAt    DateTime     @default(now())
}

model Credential {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(...)
  credentialType  String   // "academic", "identity", etc
  credentialLabel String   // User-given name
  encryptedClaims String   // AES-256-GCM encrypted
  claimHashes     Json     // { field: sha256hex }
  claimSalts      Json     // { field: 32-byte-hex-salt }
  merkleRoot      String   // Root hash (stored in JWT)
  issuerSignature String   // Ed25519 signature
  issuerPublicKey String   // Public key for verification
  shares          Share[]   // All share records
}

model Share {
  id                String     @id @default(uuid())
  credentialId      String
  credential        Credential @relation(...)
  disclosedFields   String[]   // What was shared
  presentationToken String     // JWT token
  expiresAt         DateTime   // Expiry time
  accessCount       Int        // How many times verified
  createdAt         DateTime   @default(now())
}
```

---

## 📂 Project Structure

```
trustpass/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       # JWT verification
│   │   │   ├── error.middleware.ts      # Global error handler
│   │   │   └── validate.middleware.ts   # Zod schema validation
│   │   ├── modules/
│   │   │   ├── auth/                    # Login/register
│   │   │   ├── credentials/             # Core business logic
│   │   │   │   ├── credentials.service.ts    # Issue, list, share
│   │   │   │   ├── credentials.controller.ts # Route handlers
│   │   │   │   ├── credentials.routes.ts    # Express routes
│   │   │   │   └── credentials.schema.ts    # Zod schemas
│   │   │   └── verification/            # Verify presentations
│   │   ├── services/
│   │   │   ├── crypto/                  # Ed25519, AES-256
│   │   │   ├── merkle/                  # **Selective disclosure logic**
│   │   │   ├── jwt/                     # JWT signing/verification
│   │   │   └── presentation/            # VP creation
│   │   ├── types/                       # TypeScript interfaces
│   │   ├── config/                      # Env, database
│   │   └── app.ts                       # Express setup
│   ├── tests/                           # Jest unit tests
│   ├── prisma/
│   │   ├── schema.prisma                # Database schema
│   │   └── migrations/                  # Database migrations
│   ├── scripts/
│   │   └── keygen.ts                    # Generate cryptographic keys
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx                 # Holder dashboard
│   │   │   └── credentials/
│   │   │       └── [id]/                # Credential detail + share
│   │   ├── login/                       # Login page
│   │   ├── register/                    # Register page
│   │   ├── verify/                      # Public verification page
│   │   ├── layout.tsx                   # Root layout
│   │   └── page.tsx                     # Landing page
│   ├── lib/
│   │   └── api.ts                       # Axios client + API functions
│   ├── components/                      # Reusable React components
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
│
├── docker-compose.yml                   # Local dev with PostgreSQL
├── README.md                            # This file
└── postman-collection.json              # API test suite
```

---

## 🚨 What Could Be Improved (If Given More Time)

### 1. **Advanced Cryptography**
- [ ] **BBS+ Signatures**: Better privacy with signature schemes that support selective disclosure
- [ ] **Zero-Knowledge Proofs**: Prove credential facts without revealing data (e.g., age > 18)
- [ ] **Post-Quantum Cryptography**: CRYSTALS-Dilithium or Falcon for quantum resistance
- [ ] **Threshold Signatures**: Multiple issuers need to sign for high-value credentials

**Impact**: Industry-grade privacy & quantum resistance

### 2. **Credential Revocation**
- [ ] **Revocation Registry**: Issuer can revoke credentials (e.g., expired, fraudulent)
- [ ] **Merkle CRL**: Efficient revocation without centralized service
- [ ] **Distributed Revocation**: Decentralized revocation via blockchain

**Impact**: Real-world credential lifecycle management

### 3. **Decentralization & DIDs**
- [ ] **Decentralized Identifiers (DIDs)**: Self-sovereign identity (W3C standard)
- [ ] **Blockchain Integration**: Store credentials/revocation on Ethereum or Polygon
- [ ] **IPFS Storage**: Distribute credential metadata and proofs
- [ ] **Smart Contract Verification**: On-chain verification of presentations

**Impact**: User ownership of identity, no single point of failure

### 4. **Advanced Privacy Features**
- [ ] **Blind Signatures**: Holder can't see what issuer signs
- [ ] **Anonymous Credentials**: Prove facts without credential linkability
- [ ] **Predicate Proofs**: "CGPA > 8" without revealing actual CGPA
- [ ] **Multi-Credential Proofs**: Prove facts across multiple credentials

**Impact**: Maximum privacy while maintaining trust

### 5. **Performance Optimization**
- [ ] **Merkle Accumulator**: O(1) proof size instead of O(log n)
- [ ] **Cached Trees**: Pre-compute for frequent shares
- [ ] **Database Indexing**: Optimize Merkle root lookups
- [ ] **CDN for QR Codes**: Geographic distribution

**Impact**: Scale to millions of credentials

### 6. **Enterprise Features**
- [ ] **Batch Issuance**: Issue credentials to thousands in one operation
- [ ] **Credential Templates**: Define schema once, reuse across issuers
- [ ] **Audit Logs**: Immutable record of all verification events
- [ ] **Analytics Dashboard**: Issuer insights (verification trends, fraud detection)
- [ ] **API Keys**: Service-to-service authentication

**Impact**: Production readiness for enterprises

### 7. **Mobile & UX**
- [ ] **Mobile App** (React Native): Native iOS/Android
- [ ] **Biometric Auth**: Face ID / fingerprint on mobile
- [ ] **Offline Verification**: QR code scanning without internet
- [ ] **Push Notifications**: Alert holder when credential verified
- [ ] **Dark Mode**: Better accessibility

**Impact**: Mainstream adoption

### 8. **Compliance & Standards**
- [ ] **GDPR Compliance**: Right to erasure, data portability
- [ ] **W3C VC Standard**: Industry-standard credential format
- [ ] **ISO 18013-5**: mDL (mobile Driver License) support
- [ ] **Accessibility (WCAG 2.1 AA)**: Screen reader support
- [ ] **i18n**: Multi-language support

**Impact**: Legal & regulatory compliance

### 9. **Testing & Quality**
- [ ] **E2E Tests**: Playwright/Cypress for full workflows
- [ ] **Load Testing**: Simulate 100k simultaneous users
- [ ] **Security Audit**: Third-party pen test
- [ ] **Fuzz Testing**: Random input fuzzing on APIs
- [ ] **Chaos Engineering**: Test failure scenarios

**Impact**: Production confidence

### 10. **Monitoring & Observability**
- [ ] **Real-time Metrics**: Prometheus/Grafana dashboards
- [ ] **Structured Logging**: ELK Stack for log aggregation
- [ ] **Distributed Tracing**: Jaeger for request tracing
- [ ] **Error Monitoring**: Sentry for crash reporting
- [ ] **Custom Alerts**: Slack notifications for anomalies

**Impact**: Production debugging & incident response

---

## 🎬 Demo Video

A 5-minute demo video is available showing:
1. User registration & login
2. Creating a credential with multiple fields
3. Selective sharing (checkbox selection)
4. QR code generation
5. Public verification without login
6. Verification result with trust indicators

[Watch Demo](#) ← [Link to YouTube unlisted or Google Drive]

---

## 📝 Architecture Decisions

### Why Merkle Trees?
- **Proof size**: O(log n) instead of O(n)
- **Deterministic**: Same tree for same claims
- **Proven**: Used in Bitcoin, Ethereum, Git

### Why Ed25519?
- **Modern**: NIST-approved, resistant to side-channels
- **Small keys**: 32 bytes private, 32 bytes public
- **Speed**: 20-30x faster than RSA

### Why Salts?
- **Brute-force resistance**: 2^256 search space vs. ~100 guesses
- **Per-field**: Hidden fields' salts never exposed

### Why JWT Wrap?
- **Transport integrity**: Detects tampering in transit
- **Expiry enforcement**: Shares automatically expire
- **Server authentication**: Proves token came from TrustPass

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License — See [LICENSE](./LICENSE) file

---

## 🙏 Acknowledgments

- [merkletreejs](https://github.com/miguelmota/merkletreejs) — Merkle tree library
- [Zod](https://zod.dev) — Runtime type validation
- [Shadcn/UI](https://ui.shadcn.com) — Radix UI + Tailwind components
- [Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/) — W3C standard

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/cystar/trustpass/issues)
- **Docs**: [Full Documentation](./docs/)
- **API Docs**: `http://localhost:4000/api/docs` (after running backend)

---

**Made with ❤️ for secure, privacy-preserving digital identity.**
