# Residencies by Hubs Network

An open platform for mapping hub capabilities, needs and networks — the first layer of a broader residencies ecosystem connecting **Hubs**, **Pilgrims** and **Patrons**.

## Phase 1 — Hub Registry

This phase implements:

- **Public Homepage** with project overview and featured hubs
- **Hub Registration** — a multi-step form with client/server validation
- **Hub Directory** — browse, search and filter registered hubs
- **Hub Detail Pages** — rich profile pages for each hub
- **JSON-based storage** — all data stored as structured JSON files in the repo

## Quick Start

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage
│   ├── hubs/
│   │   ├── page.tsx        # Hub directory
│   │   └── [hubId]/page.tsx # Hub detail
│   ├── register/hub/       # Registration form
│   └── api/hubs/           # API routes
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── layout/             # Header, footer
│   ├── hubs/               # Hub-specific components
│   └── forms/              # Registration form steps
├── lib/
│   ├── schemas/            # Zod validation schemas
│   ├── data/               # Data access layer
│   ├── github/             # GitHub adapter (pluggable)
│   └── utils/              # Utilities
├── config/
│   └── vocabularies.ts     # Controlled vocabularies
└── types/
    └── index.ts            # TypeScript types

data/
└── hubs/                   # Hub JSON profiles
```

## Data Philosophy

- All hub data is stored as **JSON files** under `data/hubs/`
- No external databases in this phase
- Data is transparent and git-tracked
- Can be browsed vertically (per hub) or horizontally (across hubs)

## Hub Registration

The registration form collects:

1. **Basic Info** — name, tagline, description
2. **Contact & Location** — contact person, location, languages
3. **Identity** — vocation, mission, organization type, revenue
4. **Spaces** — physical spaces with types and capacity
5. **Accommodation** — hosting options
6. **Assets** — tools, infrastructure, resources
7. **Network** — partner organizations
8. **Challenges** — current needs with impact scores
9. **Review** — summary before submission

Form progress is saved locally as a draft.

## GitHub Integration

The repository adapter (`lib/github/adapter.ts`) provides a pluggable interface for saving hub data. Currently uses local filesystem writes. To enable GitHub API integration:

1. Set environment variables:
   ```
   GITHUB_TOKEN=your_token
   GITHUB_OWNER=your_org
   GITHUB_REPO=your_repo
   GITHUB_BRANCH=main
   ```
2. Uncomment the `GitHubAPIAdapter` class in `lib/github/adapter.ts`
3. Update `getAdapter()` to use it when env vars are present

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Zod** for validation
- **Lucide React** for icons

## Future Phases

The codebase is prepared for:

- `/pilgrims` — skilled contributors applying to work at hubs
- `/patrons` — entities supporting residencies and resources
- `/residencies` — matching, tracking and evaluating residency programs

## License

Open source. Data stored in this repository is open and transparent.
