# TrustPass — Verifiable Credentials & Selective Disclosure

A production-grade digital identity system implementing **Merkle-tree based selective disclosure** with **Ed25519 signatures**. Holders can share only specific fields of their credentials while verifiers can cryptographically confirm authenticity — without seeing hidden data.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        TRUSTPASS                            │
├────────────────┬─────────────────────┬───────────────────── ┤
│   HOLDER       │    ISSUER (Backend)  │    VERIFIER          │
│  (Frontend)    │                     │   (Public Page)       │
│                │                     │                       │
│  Login/Register│ Ed25519 Keypair     │  Receives share URL   │
│  Issue Cred   ─┼─► Hash each claim   │  No login required    │
│  Select fields │    SHA-256 Merkle   │                       │
│  Share ──────  │    Sign root        │  Verifies:            │
│               ─┼─► Return VP + QR   ─┼─► JWT integrity       │
│                │                     │    Merkle proofs       │
│                │                     │    Ed25519 sig         │
│                │                     │    Expiry              │
└────────────────┴─────────────────────┴───────────────────── ┘
```

---

## How Selective Disclosure Works

### Traditional approach (❌ insecure)
```js
// Anyone can forge this
const shared = { degree: "B.Tech", graduationYear: 2027 }
```

### TrustPass approach (✅ cryptographically verifiable)

**1. Credential Issuance**
```
Claims: { name, degree, cgpa, graduationYear, marks, issuerName, issueDate }
         ↓
Hash each: SHA-256("degree:\"B.Tech CSE\"") → hex
         ↓
Build Merkle Tree (SHA-256, sortPairs: true)
         ↓
Root Hash → Sign with Ed25519 (issuer private key)
         ↓
Store: AES-256-GCM encrypted claims + claimHashes + merkleRoot + issuerSignature
```

**2. Selective Disclosure**
```
Holder selects: ["degree", "graduationYear"]
         ↓
Decrypt claims (server-side only)
         ↓
Rebuild Merkle tree (deterministic)
         ↓
Generate Merkle proof paths for selected fields only
         ↓
Build VP: { disclosedClaims, merkleProofs, merkleRoot, issuerSignature, issuerPublicKey }
         ↓
Sign VP as JWT → QR code → Share URL
         ↓
Hidden fields (cgpa, marks, name) are NEVER included
```

**3. Verification (zero knowledge)**
```
Receive presentationToken
         ↓
1. Verify JWT signature (transport integrity)
2. Check expiresAt
3. For each disclosed field:
   - Recompute leaf: SHA-256("field:value")
   - Verify Merkle proof against merkleRoot → must match
4. Verify Ed25519 signature over merkleRoot
         ↓
✅ Verified — or — ❌ Invalid with specific failure reason
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Backend | Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Crypto | Node `crypto` (Ed25519) + `merkletreejs` (SHA-256 Merkle) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Validation | Zod |
| QR Code | `qrcode` |
| Security | Helmet + express-rate-limit + CORS |
| Docs | Swagger/OpenAPI at `/api/docs` |

---

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- PostgreSQL running locally

### 1. Clone & Setup Backend
```bash
cd backend
npm install
npm run keygen   # Generate Ed25519 keys — copy output to .env
```

Create `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/trustpass"
JWT_SECRET="<from keygen>"
ENCRYPTION_KEY="<from keygen>"
ISSUER_PRIVATE_KEY="<from keygen>"
ISSUER_PUBLIC_KEY="<from keygen>"
ISSUER_NAME="TrustPass Authority"
PORT=4000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

```bash
npm run db:migrate   # Run Prisma migrations
npm run dev          # Start backend on :4000
```

### 2. Setup Frontend
```bash
cd frontend
npm install
# Create .env.local:
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000/api' > .env.local
npm run dev          # Start frontend on :3000
```

### 3. Open
- **App**: http://localhost:3000
- **API Docs**: http://localhost:4000/api/docs
- **Health**: http://localhost:4000/api/health

---

## Docker (One Command)

```bash
# Copy .env.example to .env and fill in the keys
cp backend/.env.example .env
# Edit .env with your generated keys

docker-compose up --build
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Get current user |

### Credentials (Bearer token required)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/credentials/issue` | Issue signed credential |
| GET | `/api/credentials` | List credentials |
| GET | `/api/credentials/:id` | Get credential detail |
| POST | `/api/credentials/share` | Create VP + QR |

### Public
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/credentials/verify` | Verify presentation (rate-limited 10/min) |
| GET | `/api/credentials/share?token=...` | Fetch VP by token |
| GET | `/api/health` | Health check |

Full Swagger docs: **http://localhost:4000/api/docs**

---

## Security Features

- **Ed25519 signatures** — issuer signs Merkle root, impossible to forge
- **Merkle proof verification** — each disclosed field has an independent proof
- **AES-256-GCM encryption** — stored claims are encrypted at rest
- **JWT transport integrity** — presentations are signed JWTs
- **Expiring share links** — configurable 1h / 24h / 7d / 30d
- **Rate limiting** — 10 req/min on verify endpoint
- **bcrypt** password hashing (rounds=12)
- **Helmet** security headers
- **Zod** input validation on all endpoints
- **CORS** whitelist

---

## Testing

```bash
cd backend
npm test              # Run all unit tests (25 tests)
npm run test:coverage # With coverage report
```

Tests cover:
- Merkle tree construction (determinism, tamper detection)
- Ed25519 sign/verify (keypair, wrong key, tampered sig)
- Cross-field attack prevention
- Proof verification with wrong root

---

## Project Structure

```
CyStar/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── credentials/
│   │   │   └── verification/
│   │   ├── services/
│   │   │   ├── crypto/        (Ed25519 + AES-256-GCM)
│   │   │   ├── merkle/        (SHA-256 Merkle tree)
│   │   │   ├── jwt/           (auth + VP signing)
│   │   │   └── presentation/  (VP assembly)
│   │   ├── middleware/
│   │   ├── config/
│   │   └── types/
│   ├── tests/
│   │   └── unit/
│   ├── prisma/
│   └── scripts/keygen.ts
└── frontend/
    ├── app/
    │   ├── login/
    │   ├── register/
    │   ├── dashboard/
    │   │   ├── page.tsx         (credential wallet)
    │   │   ├── issue/           (issue credential)
    │   │   └── credentials/[id]/share/  (selective share + QR)
    │   └── verify/              (public verification page)
    └── lib/
        └── api.ts               (typed API client)
```
