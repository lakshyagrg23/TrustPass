# TrustPass — Verifiable Credentials & Selective Disclosure

**A production-grade digital identity system implementing Merkle-tree based selective disclosure with Ed25519 signatures.**

Holders can share **only specific fields** of their credentials while verifiers can **cryptographically confirm authenticity** — without seeing hidden data.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Features](#features)
- [Architecture](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Security](#security-considerations)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Future Directions](#future-directions)
- [Architecture Decisions](#architecture-decisions)

---

## Live Application

- **Deployment**: [https://trust-pass-ashy.vercel.app](https://trust-pass-ashy.vercel.app)
- **API Swagger Docs**: [https://trustpass-ioi6.onrender.com/api/docs](https://trustpass-ioi6.onrender.com/api/docs)
- **Demo Video**: [https://drive.google.com/file/d/1Od7C_63ff7FK6Usw11c0DiI9c5tok3wJ/view](#demo-video)

---

## Problem Statement

Digital identity verification today faces a fundamental privacy-security tradeoff:

- **Traditional approach**: Share entire credential → Verifier sees everything (privacy loss)
- **Verification challenge**: How to prove "I have degree X" without exposing CGPA, SSN, marks?

**TrustPass solves this** with **selective disclosure** — cryptographic proof that specific fields are authentic, without revealing the rest.

---

## Features

### Holder (Credential Owner)

- Modern dashboard with JWT-based authentication
- Issue credentials with multiple claims (name, degree, CGPA, marks, etc.)
- **Selective field disclosure** — choose which fields to share
- Generate verifiable, time-limited share links
- QR code generation for one-tap sharing
- Access tracking (see who verified your credentials)
- Mobile-first responsive design

### Verifier (Credential Recipient)

- Public verification page (no login required)
- Clear verification status with detailed trust indicators
- See ONLY the fields holder chose to share
- Cryptographic proof of authenticity
- View issuer details, issue date, expiration
- Access from any device (desktop, mobile)

### Backend Security

- **Merkle-tree selective disclosure** — production-grade cryptography
- Ed25519 signatures for issuer authenticity
- AES-256-GCM encryption of claims at rest
- Per-field random salts preventing brute-force attacks
- JWT with expiry enforcement
- Rate limiting on verification endpoints
- Input validation & sanitization (Zod)
- Comprehensive error handling

---

## Architecture Overview

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

## Selective Disclosure Deep-Dive

### How It Works (3-Layer Cryptography)

**System Overview**

```mermaid
flowchart TB
    subgraph Phase1["Phase 1: Credential Issuance"]
        A[Holder Creates Credential]
        B[Generate Salted Claim Hashes]
        C[Build Merkle Tree]
        D[Sign Merkle Root with Ed25519]
        E[Credential Stored]
    end

    subgraph Phase2["Phase 2: Credential Sharing"]
        F[Select Fields to Share]
        G[Generate Verifiable Presentation]
        H[Share Link / QR Code]
    end

    subgraph Phase3["Phase 3: Credential Verification"]
        I[Verifier Opens Link]
        J[Verify Merkle Proofs]
        K[Verify Ed25519 Signature]
        L[Verified Credential]
    end

    A --> B
    B --> C
    C --> D
    D --> E

    E --> F
    F --> G
    G --> H

    H --> I
    I --> J
    J --> K
    K --> L
```

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

**Merkle Tree Construction Example**

```mermaid
flowchart TB

    A["name: Alice"]
    B["degree: B.Tech"]
    C["cgpa: 9.2"]
    D["graduationYear: 2027"]

    A --> H1["Salted Hash H1"]
    B --> H2["Salted Hash H2"]
    C --> H3["Salted Hash H3"]
    D --> H4["Salted Hash H4"]

    H1 --> N1["Node A"]
    H2 --> N1

    H3 --> N2["Node B"]
    H4 --> N2

    N1 --> ROOT["Merkle Root"]
    N2 --> ROOT

    ROOT --> SIG["Ed25519 Signature"]
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

```mermaid
flowchart LR

    A["Degree = B.Tech"]
    B["Salt"]
    C["Leaf Hash"]

    D["Merkle Proof Path"]
    E["Merkle Root"]

    F["Issuer Signature"]
    G["Issuer Public Key"]

    H["Verification Result"]

    A --> C
    B --> C

    C --> E
    D --> E

    E --> H
    F --> H
    G --> H
```

**Detailed Verification Steps**

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

| Threat                                   | Mitigation                                               |
| ---------------------------------------- | -------------------------------------------------------- |
| Attacker forges a credential             | Ed25519 signature prevents (only issuer has private key) |
| Attacker modifies a disclosed field      | Merkle proof will fail verification                      |
| Attacker tries to include a hidden field | Salt not included → Proof can't be computed              |
| Attacker brute-forces sibling hashes     | 32-byte random salt → 2^256 guesses needed               |
| Attacker replays old token               | JWT expiry + accessCount tracking                        |
| Man-in-the-middle intercepts             | JWT signature detects tampering                          |

---

## Tech Stack

| Layer              | Technology                         | Why                                               |
| ------------------ | ---------------------------------- | ------------------------------------------------- |
| **Frontend**       | Next.js 16 + React 19 + TypeScript | Server-side rendering + API routes + type safety  |
|                    | Tailwind CSS + Radix UI            | Mobile-first, accessible components               |
| **Backend**        | Express 5 + TypeScript             | Lightweight, fast, production-proven              |
|                    | Prisma ORM                         | Type-safe DB queries, auto migrations             |
| **Database**       | PostgreSQL                         | ACID compliance, JSON support, proven reliability |
| **Cryptography**   | Node `crypto` (native)             | Ed25519, SHA-256, AES-256-GCM                     |
|                    | `merkletreejs`                     | Efficient Merkle tree operations                  |
| **Authentication** | JWT + bcrypt                       | Stateless auth, secure password hashing           |
| **Validation**     | Zod                                | Runtime type validation                           |
| **QR Codes**       | `qrcode`                           | Share link encoding                               |
| **Security**       | Helmet + rate-limit                | HTTP headers + brute-force protection             |
| **Documentation**  | Swagger/OpenAPI                    | Auto-generated interactive API docs               |

---

## Quick Start

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

## Docker Deployment

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

## API Documentation

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
    "availableFields": [
      "name",
      "degree",
      "graduationYear",
      "cgpa",
      "marks",
      "issuerName"
    ],
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

## Testing

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

## Deployment

✅ **Currently deployed to:**

- Backend: Render (PostgreSQL managed)
- Frontend: Vercel (auto-deploys from Git)

See [Live Deployment](https://trust-pass-ashy.vercel.app)

---

## Security Considerations

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

## Database Schema

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

## Project Structure

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

## Future Directions

Potential enhancements for production rollout:

### Current Limitations

- **Mock Aadhaar**: Currently using simulated Aadhaar data; integrate real Aadhaar authentication (UIDAI API)
- **Single-user credential issuance**: All users can issue credentials; needs role-based access control
  - **Solution**: Add role types (User, Issuing Authority, Admin) with permission gates

### Planned Features

- **Mobile App** (React Native): Native iOS/Android for credential management on-the-go
- **Zero-Knowledge Proofs**: Prove facts (e.g., age > 18, CGPA > 8) without revealing actual values

---

## Architecture Decisions

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
