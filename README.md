# Residencies by Hubs Network

An open platform for mapping hub capabilities, needs and networks — the first layer of a broader residencies ecosystem connecting **Hubs**, **Pilgrims** and **Patrons**.

## Phase 1 — Hub Registry

- **Public Homepage** with project overview and featured hubs
- **Hub Registration** — multi-step form (only Basic Info required, rest optional)
- **Hub Directory** — browse, search and filter registered hubs
- **Hub Detail Pages** — rich profile pages for each hub
- **Authentication** — Magic email login + injected wallets (MetaMask/Rabby)
- **On-chain Safe Multisig Admin** — each hub is governed by a Safe on Sepolia
- **Gas-sponsored transactions** — users never pay gas (Magic via Alchemy, injected via relay)
- **Multisig governance** — threshold-based approval for admin operations
- **My Hubs** — personal dashboard of hubs you own or administer
- **Hub deletion** — owners can permanently delete hubs
- **JSON-based storage** — public profile data stored as JSON on GitHub

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                  │
│  Auth: Magic (email) │ MetaMask/Rabby (injected)     │
└────────────┬─────────────────────────┬───────────────┘
             │                         │
    ┌────────▼────────┐      ┌────────▼────────────┐
    │  Alchemy Gas    │      │  Relay Backend       │
    │  Manager        │      │  /api/relay          │
    │  (Magic users)  │      │  (injected users)    │
    └────────┬────────┘      └────────┬────────────┘
             │                         │
             └──────────┬──────────────┘
                        │
              ┌─────────▼──────────┐
              │  Sepolia Blockchain │
              │  Safe Multisig      │
              └────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  Neon Postgres      │
              │  - Proposals        │
              │  - Confirmations    │
              │  - Legacy admins    │
              └────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  GitHub Contents API│
              │  Public JSON files  │
              └────────────────────┘
```

---

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in values (see Environment Variables below)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

---

## Environment Variables

| Variable | Required | Side | Description |
|----------|----------|------|-------------|
| `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` | Yes | Client | Magic SDK publishable key (from dashboard.magic.link) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Yes | Client | Alchemy API key for Smart Wallets + Gas Manager |
| `NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID` | Yes | Client | Alchemy Gas Manager policy ID (Sepolia) |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Yes | Client | Sepolia RPC URL (e.g. `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`) |
| `NEXT_PUBLIC_SAFE_TX_SERVICE_URL` | Optional | Client | Safe Transaction Service URL (default: `https://safe-transaction-sepolia.safe.global`) |
| `NEXT_PUBLIC_CHAIN_ID` | Optional | Client | Chain ID (default: `11155111` for Sepolia) |
| `SEPOLIA_RPC_URL` | Yes | Server | Sepolia RPC for server-side reads |
| `RELAYER_PRIVATE_KEY` | Yes | Server | Private key of the funded relayer wallet (pays gas for injected wallet users) |
| `DATABASE_URL` | Yes | Server | Neon Postgres connection string |
| `MAGIC_SECRET_KEY` | Optional | Server | Magic secret key (for future server-side verification) |
| `ADMIN_MANAGEMENT_SECRET` | Optional | Server | Secret for `/admin/dev` tool |
| `GITHUB_TOKEN` | Production | Server | GitHub PAT for JSON persistence |
| `GITHUB_OWNER` | Production | Server | GitHub org/user (e.g. `Hubs-Network`) |
| `GITHUB_REPO` | Production | Server | GitHub repository name (e.g. `hnv1`) |
| `HOLONS_WEBHOOK_SECRET` | Future | Server | For Holons bot integration |

---

## External Services

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| **Magic** | Email-based embedded wallet login | [dashboard.magic.link](https://dashboard.magic.link) |
| **Alchemy** | Sepolia RPC + Gas Manager (sponsors gas for Magic users) | [dashboard.alchemy.com](https://dashboard.alchemy.com) |
| **Neon Postgres** | Private data: proposals, confirmations, legacy admins | [console.neon.tech](https://console.neon.tech) |
| **GitHub** | Public hub profile JSON storage | [github.com/Hubs-Network/hnv1](https://github.com/Hubs-Network/hnv1) |
| **Vercel** | Hosting & deployment | [vercel.com](https://vercel.com) |
| **Safe (Sepolia)** | On-chain multisig for hub governance | [app.safe.global](https://app.safe.global) |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage
│   ├── hubs/
│   │   ├── page.tsx                # Hub directory
│   │   ├── [hubId]/page.tsx        # Hub detail
│   │   └── [hubId]/edit/           # Hub editing (admin-only)
│   ├── my-hubs/                    # Personal hub dashboard
│   ├── register/hub/               # Registration form
│   ├── admin/
│   │   ├── dev/                    # Legacy dev admin tool
│   │   └── sponsored-tx-test/      # Magic Smart Account test page
│   └── api/
│       ├── hubs/                   # Hub CRUD (GET, POST)
│       ├── hubs/[hubId]/           # Hub detail (GET, PUT, DELETE)
│       ├── hubs/[hubId]/admins/    # Admin listing (Safe owners)
│       ├── admins/                 # Admin check, my-hubs
│       └── relay/                  # ← NEW: Gas relay system
│           ├── route.ts            # Direct relay (threshold=1, injected wallets)
│           ├── propose/            # Propose multisig tx (threshold>1)
│           ├── confirm/            # Add confirmation signature
│           ├── pending/            # List pending proposals
│           └── execute/            # Execute with enough signatures
├── components/
│   ├── ui/                         # Reusable UI (Button, Card, Input...)
│   ├── layout/                     # Header, Footer
│   ├── auth/                       # LoginPanel, UserWalletBadge
│   ├── hubs/                       # HubCard, AdminPanel, PendingTransactions
│   └── forms/                      # Registration form steps
├── context/
│   └── auth-context.tsx            # Auth state (Magic + injected wallets)
├── lib/
│   ├── magic.ts                    # Magic SDK singleton (+ SmartAccountExtension)
│   ├── magic-smart-account.ts      # Sponsored tx helper (Magic users)
│   ├── safe.ts                     # Server-side Safe SDK helpers
│   ├── safe-client.ts              # Client-side Safe deployment
│   ├── safe-operations.ts          # ← CORE: Safe owner mgmt operations
│   ├── hub-admin.ts                # Unified admin check (Safe + legacy)
│   ├── env.ts                      # Environment variable validation
│   ├── admin.ts                    # @deprecated Legacy Neon admin functions
│   ├── db.ts                       # Neon Postgres client
│   ├── schemas/hub.ts              # Zod schemas
│   ├── data/hubs.ts                # Data access (GitHub/filesystem)
│   └── github/                     # GitHub Contents API adapter
├── config/
│   └── vocabularies.ts             # Controlled vocabularies
└── types/
    └── index.ts                    # TypeScript interfaces

migrations/                         # SQL migrations for Neon
  ├── 001_profile_admins.sql        # Legacy admin table
  └── 002_safe_proposals.sql        # Multisig proposals + confirmations
```

---

## Authentication

Two login modes:

1. **Magic email login** — passwordless OTP, creates an embedded wallet with Smart Account (ERC-4337). Gas is sponsored via Alchemy Gas Manager.
2. **Injected wallet** — MetaMask, Rabby, or any EIP-1193 wallet. Gas is sponsored via backend relay (a funded wallet submits txs on behalf of the user).

ENS name resolution is available for injected wallet users (Ethereum mainnet lookup).

---

## On-chain Admin System (Safe Multisig)

Each hub is governed by a **Safe multisig contract on Sepolia**. The Safe address IS the hub's canonical ID.

### Hub Registration Flow

1. User logs in (Magic or MetaMask)
2. Fills the registration form (only Basic Info required)
3. Client deploys a new Safe on Sepolia (gas-sponsored) with the creator as sole owner (threshold=1)
4. Safe address is stored as `hub.id` and `hub.safeAddress` in the JSON
5. Server verifies ownership on-chain before saving

### Admin Permissions

- A wallet that is a **Safe owner** can edit the hub profile
- The first owner (deployer) is labeled "owner"; others are "admin"
- Permissions are verified server-side by reading the Safe contract directly on-chain

### Admin Operations (threshold=1)

When threshold is 1, any single owner can directly execute:
- Add owner
- Remove owner
- Change threshold

The operation is:
- **Magic users**: Built as `execTransaction` calldata with pre-approved signature → sent via Alchemy Gas Manager (zero gas)
- **Injected wallet users**: User signs EIP-712 typed data → sent to `/api/relay` → relayer submits on-chain (zero gas for user)

### Admin Operations (threshold>1)

When threshold > 1, operations require multiple signatures:

1. **Propose**: Owner signs EIP-712 → proposal stored in Neon DB (`safe_proposals` table)
2. **Confirm**: Other owners see pending proposals → sign → confirmation stored (`safe_confirmations` table)
3. **Execute**: When enough confirmations exist → `/api/relay/execute` combines signatures and submits via relayer

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/safe-operations.ts` | Client-side: builds calldata, handles signing, routes to relay or Magic |
| `src/lib/safe.ts` | Server-side: reads Safe info from chain, verifies ownership |
| `src/lib/hub-admin.ts` | Unified admin check (on-chain Safe + legacy Neon fallback) |
| `src/app/api/relay/route.ts` | Relay: verifies owner, submits tx via relayer wallet |
| `src/app/api/relay/propose/route.ts` | Stores multisig proposals in DB |
| `src/app/api/relay/confirm/route.ts` | Adds confirmation signatures |
| `src/app/api/relay/execute/route.ts` | Combines signatures + executes via relayer |
| `src/components/hubs/admin-panel.tsx` | UI for owner management + threshold |
| `src/components/hubs/pending-transactions.tsx` | UI for viewing/confirming/executing proposals |

---

## Gas Sponsorship

**No user ever pays gas.** Two mechanisms:

| User type | Mechanism | How it works |
|-----------|-----------|--------------|
| Magic (email) | Alchemy Gas Manager | Smart Account sends UserOperation, Alchemy pays |
| Injected (MetaMask) | Backend Relay | User signs message (free), relayer wallet pays gas |

The relayer wallet must be funded with SepoliaETH. Monitor its balance periodically.

---

## Database Setup (Neon)

Run both migrations in the Neon SQL Editor:

1. `migrations/001_profile_admins.sql` — Legacy admin table (still used for old hubs)
2. `migrations/002_safe_proposals.sql` — Multisig proposals and confirmations

---

## GitHub Integration

In production (Vercel), hub profiles are persisted as JSON via the GitHub Contents API:

```env
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=Hubs-Network
GITHUB_REPO=hnv1
```

In local development, the filesystem adapter is used as fallback.

---

## Legacy System

Some hubs created before the Safe migration use slug-based IDs and Neon Postgres for admin management. The codebase maintains backward compatibility:

- `hub-admin.ts` checks if a hub ID is an Ethereum address (Safe-based) or a slug (legacy)
- Legacy hubs use `profile_admins` table in Neon
- Safe-based hubs use on-chain ownership

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2 | App Router, SSR, API routes |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | v4 | Styling |
| Zod | 3.x | Schema validation |
| Magic SDK | latest | Email auth + Smart Account |
| `@magic-ext/smart-account` | latest | Alchemy Gas Manager integration |
| `@safe-global/protocol-kit` | latest | Safe deployment + tx building |
| `@safe-global/api-kit` | latest | Safe Transaction Service (optional) |
| viem | 2.x | Ethereum interactions (encoding, chain reads) |
| ethers.js | 6.x | ENS resolution, injected wallet connection |
| postgres | latest | Neon DB client |
| Lucide React | latest | Icons |

---

## Hub Registration (Form Steps)

1. **Basic Info** — name, tagline, description *(required)*
2. **Contact & Location** — website, location
3. **Identity** — vocation, mission, organization type, revenue model
4. **Spaces** — physical spaces with types and capacity
5. **Accommodation** — hosting options
6. **Challenges** — current needs with urgency (1=year+ / 5=month) and impact scores
7. **Assets** — tools, infrastructure, resources
8. **Network** — partner organizations
9. **Review** — summary before submission

---

## Future: Holons Integration

The codebase is prepared for [Holons](https://docs.holons.io/) bot integration:

- Type scaffolding in `src/lib/admin.ts`
- Webhook endpoint pattern ready for `HOLONS_WEBHOOK_SECRET` authentication
- Holons could be added as a Safe owner or module for automated operations

---

## Future Phases

- `/pilgrims` — skilled contributors applying to work at hubs
- `/patrons` — entities supporting residencies and resources
- `/residencies` — matching, tracking and evaluating residency programs

---

## Deployment (Vercel)

Required environment variables on Vercel:
- All `NEXT_PUBLIC_*` variables
- `RELAYER_PRIVATE_KEY`
- `DATABASE_URL`
- `SEPOLIA_RPC_URL`
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`

Build settings:
- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`

---

## License

Open source. Data stored in this repository is open and transparent.
