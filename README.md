# Residencies by Hubs Network

An open platform for mapping hub capabilities, needs and networks — the first layer of a broader residencies ecosystem connecting **Hubs**, **Pilgrims** and **Patrons**.

## Phase 1 — Hub Registry

This phase implements:

- **Public Homepage** with project overview and featured hubs
- **Hub Registration** — multi-step form (only Basic Info is required, rest is optional)
- **Hub Directory** — browse, search and filter registered hubs
- **Hub Detail Pages** — rich profile pages for each hub
- **Authentication** — Magic email login + injected wallets (MetaMask/Rabby)
- **Private Admin Registry** — wallet-based permissions stored in Neon Postgres
- **My Hubs** — personal dashboard of hubs you own or administer
- **Collaborative editing** — owners can add admin wallets to share editing access
- **JSON-based storage** — public profile data stored as JSON on GitHub

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your values (see Environment Variables below)

# Run the development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Environment Variables

| Variable | Required | Side | Description |
|----------|----------|------|-------------|
| `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` | Yes | Client | Magic SDK publishable key |
| `DATABASE_URL` | Yes | Server | Neon Postgres connection string |
| `ADMIN_MANAGEMENT_SECRET` | Optional | Server | Secret for `/admin/dev` tool |
| `GITHUB_TOKEN` | Production | Server | GitHub PAT for JSON persistence |
| `GITHUB_OWNER` | Production | Server | GitHub org/user |
| `GITHUB_REPO` | Production | Server | GitHub repository name |
| `HOLONS_WEBHOOK_SECRET` | Future | Server | For Holons bot integration |

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── hubs/
│   │   ├── page.tsx          # Hub directory
│   │   ├── [hubId]/page.tsx  # Hub detail
│   │   └── [hubId]/edit/     # Hub editing (multi-step form)
│   ├── my-hubs/              # Personal hub dashboard
│   ├── register/hub/         # Registration form
│   ├── admin/dev/            # Dev admin tool (secret-protected)
│   └── api/
│       ├── hubs/             # Hub CRUD
│       ├── hubs/[hubId]/admins/  # Admin management (owner-only)
│       └── admins/           # Admin check/add/remove/list
├── components/
│   ├── ui/                   # Reusable UI components
│   ├── layout/               # Header, footer
│   ├── auth/                 # Login panel, wallet badge
│   ├── hubs/                 # Hub card, edit button, admin panel
│   └── forms/                # Registration form steps
├── context/
│   └── auth-context.tsx      # Authentication state (Magic + injected)
├── lib/
│   ├── admin.ts              # Admin check/add/remove functions (Neon)
│   ├── db.ts                 # Neon Postgres client
│   ├── magic.ts              # Magic SDK initialization
│   ├── schemas/              # Zod validation schemas
│   ├── data/                 # Data access layer
│   ├── github/               # GitHub adapter
│   └── utils/                # Utilities
├── config/
│   └── vocabularies.ts       # Controlled vocabularies
└── types/
    └── index.ts              # TypeScript types

migrations/                   # SQL migrations for Neon
```

## Authentication

Two login modes are supported:

1. **Magic email login** — passwordless OTP via Magic SDK, creates an embedded wallet
2. **Injected wallet** — MetaMask, Rabby, or any EIP-1193 compatible wallet

ENS name resolution is available for injected wallet users on Ethereum mainnet.

## Admin & Permissions

Admin permissions are stored **privately** in Neon Postgres — never in the public JSON files on GitHub.

- When a user registers a hub, their wallet is automatically set as **owner**
- Owners can add other wallet addresses as **admins** from the hub edit page
- Admins can edit the hub profile; only owners can manage the admin list
- The `/api/admins/check` endpoint verifies wallet permissions server-side before allowing edits

### Database Setup

Run in the Neon SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS profile_admins (
  id SERIAL PRIMARY KEY,
  profile_id TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('hub', 'pilgrim')),
  wallet_address TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(profile_id, profile_type, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_profile_admins_lookup
ON profile_admins (profile_id, profile_type, wallet_address);
```

## Hub Registration

Only **Basic Info** (name, tagline, description) is required. All other sections are optional and can be filled later:

1. **Basic Info** — name, tagline, description *(required)*
2. **Contact & Location** — website, location
3. **Identity** — vocation, mission, organization type, revenue
4. **Spaces** — physical spaces with types and capacity
5. **Accommodation** — hosting options
6. **Challenges** — current needs with urgency/impact scores
7. **Assets** — tools, infrastructure, resources
8. **Network** — partner organizations
9. **Review** — summary before submission

Form progress is saved locally as a draft.

## GitHub Integration

In production (Vercel), hub profiles are persisted as JSON via the GitHub Contents API:

```env
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=Hubs-Network
GITHUB_REPO=hnv1
```

In local development, the filesystem adapter is used as fallback.

## Future: Holons Integration

The codebase is architecturally prepared for [Holons](https://docs.holons.io/) bot integration:

- Type scaffolding (`AdminSubject`) in `src/lib/admin.ts`
- Future `profile_access` table will support `subject_type = 'integration'`
- Webhook endpoint pattern ready for `HOLONS_WEBHOOK_SECRET` authentication

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Zod** for validation
- **Magic SDK** for email authentication
- **Ethers.js** for wallet connection + ENS
- **Neon Postgres** for private admin registry
- **Lucide React** for icons

## Future Phases

The codebase is prepared for:

- `/pilgrims` — skilled contributors applying to work at hubs
- `/patrons` — entities supporting residencies and resources
- `/residencies` — matching, tracking and evaluating residency programs

## License

Open source. Data stored in this repository is open and transparent.
