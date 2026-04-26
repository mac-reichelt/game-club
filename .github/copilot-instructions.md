# Copilot Instructions — Game Club

## Project Overview
A "book club, but for games" web app. Members nominate games, vote via ranked-choice elections, then play and review the winner together. Built with Next.js 15 (App Router) + TypeScript + SQLite + Tailwind CSS 4.

## Architecture

### Key Patterns
- **App Router**: All routes under `src/app/`. Pages are server components by default; client components marked with `"use client"`.
- **API routes**: `src/app/api/` handlers use `NextRequest`/`NextResponse`. Auth checked via `getCurrentUser()` or `requireAuth()`.
- **SQLite + better-sqlite3**: Synchronous driver. Database initialized in `src/lib/db.ts` with WAL mode and foreign keys enabled. Data stored at `/app/data/gameclub.db` in Docker.
- **Cookie-based sessions**: 32-byte hex token stored in `session_token` HttpOnly cookie (30-day expiry). No JWT — sessions stored in DB `sessions` table.
- **Ranked Choice Voting**: `src/lib/rcv.ts` implements instant-runoff voting. Used by `src/lib/elections.ts` to tally and close elections.

### Data Flow
1. Members sign up/log in → session cookie set
2. Nominate games (optionally search RAWG for metadata)
3. Admin creates election from nominated games (2+ required)
4. Members submit ranked ballots (one per election)
5. Election auto-closes after 72 hours OR admin manually closes
6. RCV algorithm runs → winner becomes "current" game
7. After playing, members submit reviews with ratings

### Module Map
- `src/app/api/` — API route handlers (auth, games, elections, members)
- `src/app/` — Page components (dashboard, nominations, elections, history, profile, login)
- `src/components/` — Shared components (Navbar, CountdownTimer)
- `src/lib/db.ts` — Database schema + initialization
- `src/lib/auth.ts` — Password hashing (SHA256+salt), session management
- `src/lib/rcv.ts` — Ranked choice voting algorithm
- `src/lib/elections.ts` — Election management (close, tally, auto-expire)
- `src/lib/types.ts` — TypeScript interfaces
- `src/lib/seed.ts` — Sample data seeder (`npm run seed`)
- `src/middleware.ts` — Auth middleware (redirects unauthenticated users to /login)

### Database Tables
`members`, `games`, `elections`, `election_games`, `ballots`, `election_rounds`, `reviews`, `sessions`

## Conventions

### Code Style
- TypeScript strict mode enabled
- Path alias: `@/*` maps to `src/*`
- ESLint with `next/core-web-vitals` rules
- Tailwind CSS 4 with custom CSS variables (dark theme)

### Testing
- Vitest with globals enabled
- Path alias configured in `vitest.config.ts`
- Tests in `src/__tests__/` — focus on pure logic (rcv, auth, elections)
- Run: `npm test`

### Docker
- Multi-stage Dockerfile: deps → builder → runner (Node 22 Alpine)
- Non-root `nextjs` user (UID 1001)
- Standalone Next.js output for minimal image size
- SQLite data persisted via Docker volume at `/app/data`
- Health check via wget

### Page Patterns
- Server components fetch data directly from DB (no API call needed)
- Client components (`"use client"`) for interactive forms, ballot submission
- `dynamic = "force-dynamic"` on pages that must always be fresh
- `checkAndCloseExpiredElections(db)` called on dashboard load

## External APIs
| Source | Auth | Notes |
|--------|------|-------|
| RAWG | API key (optional) | Game search for nominations. If `RAWG_API_KEY` not set, search is disabled (returns 503) |

## Gotchas
- better-sqlite3 is synchronous — don't use in hot loops or it blocks the event loop
- Password hashing uses SHA256 (not bcrypt) — adequate for a private club app, not for public-facing auth
- Election auto-close runs on dashboard page load, not via cron — if nobody visits, elections may stay open past deadline
- `next lint` requires `eslint.config.mjs` to exist — without it, the command prompts interactively and hangs in CI
- RAWG API key is optional — the app works without it, but game search/import is disabled
- Telemetry disabled in Docker: `NEXT_TELEMETRY_DISABLED=1`

## Agent Routing

Before editing files in the paths below, consult the indicated specialist agents
(in `.github/agents/`). Include a "Consulted:" line in your PR description listing
which agents you consulted and why (e.g., "Consulted: security-review per routing matrix (auth changes)").

| Path glob | Agent(s) to consult before editing |
|---|---|
| `src/lib/auth.ts`, `src/middleware.ts` | `security-review` |
| `src/app/api/**` | `software-engineer` + `security-review` (input validation) |
| `src/lib/db.ts` (schema changes) | `architect` |
| `src/lib/db.ts`, `src/lib/types.ts` | `architect` (new tables/interfaces) |
| `src/lib/rcv.ts`, `src/lib/elections.ts` | `qa-engineer` (algorithm correctness) |
| `compose.yml`, `Dockerfile` | `devops-engineer` |
| `.github/workflows/**` | `devops-engineer` + `security-review` |
| `.github/agents/**`, `.github/instructions/**` | `devops-engineer` |
| `src/__tests__/**` | `qa-engineer` |
| `docs/**`, `README.md`, `CONTRIBUTING.md` | `tech-writer` |

### How to declare consultations in PR descriptions

Add a section to your PR body:

```markdown
## Consulted

- `security-review` per routing matrix (changes to src/lib/auth.ts)
- `devops-engineer` per routing matrix (changes to .github/workflows/)
```

If a path glob applies but the change is trivial (typo fix, rename only), you may
skip consultation but must note it: "No agent consultation needed — trivial rename only."
