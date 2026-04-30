# 🎮 Game Club

[![Build & Publish](https://github.com/mac-reichelt/game-club/actions/workflows/main.yml/badge.svg)](https://github.com/mac-reichelt/game-club/actions/workflows/main.yml)

A web app for managing a game club — like a book club, but for games. Nominate games, vote with ranked choice voting, track your history, and leave reviews.

## Features

- **Dashboard** — See what's currently being played, recent elections, nominations, and completed games
- **Nominations** — Nominate games and start monthly elections
- **Ranked Choice Voting** — Members rank games by preference; instant-runoff tallying determines the winner
- **Elections** — Monthly votes auto-named "\<month\> \<year\>" with full historical records
- **History** — Browse all completed games with ratings and reviews
- **Members** — Manage club members and see their activity stats

## How Voting Works

1. Members nominate games throughout the month
2. An admin starts a monthly election, selecting which nominations to include
3. Each member submits a ranked ballot (1st choice, 2nd choice, etc.)
4. When the election closes, ranked choice voting runs:
   - Count first-choice votes
   - If a game has >50%, it wins
   - Otherwise, eliminate the game with fewest first-choice votes
   - Redistribute those ballots to voters' next choices
   - Repeat until a winner emerges
5. The winner becomes the current "Game of the Month"

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router, standalone output)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [SQLite](https://www.sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

## Development

This project uses a **Dev Container** for development. Open the project in VS Code and use the "Reopen in Container" command, or:

```bash
npm install
npm run seed    # Load sample data
npm run dev     # Start dev server at http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SIGNUP_INVITE_CODE` | **Yes** | Invite code required for new-member sign-up. Set to a strong random string (`openssl rand -hex 24`). If unset, sign-up is disabled (fail-closed). |
| `RAWG_API_KEY` | No | API key for [RAWG](https://rawg.io/apidocs) game search. Without it, game search is disabled. |

## Invite-Code Workflow

Sign-up is gated behind a shared invite code stored in the `SIGNUP_INVITE_CODE`
environment variable. This prevents anonymous users from registering once the
app is exposed to the internet.

**Setup:**

```bash
# Generate a strong random code
openssl rand -hex 24
# Example output: a3f8c2d1e9b0456f78a2c4d6e8f0a1b2c3d4e5f6
```

Set `SIGNUP_INVITE_CODE` in your environment (`.env.local` for dev,
`compose.yml` for Docker) to the generated value. Share the code with the
people you want to invite.

**Behaviour:**

- If `SIGNUP_INVITE_CODE` is **not set** → sign-up is disabled (returns 403).
- If the code is **missing or wrong** in a sign-up request → 403 is returned.
- If the code **matches** → account is created and the user is auto-logged in.

**Rotating the code:**

Update the env var and restart the app. Existing sessions are unaffected; only
future sign-up attempts will require the new code.

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build manually
docker build -t gameclub .
docker run -p 3000:3000 -v gameclub-data:/app/data gameclub
```

The SQLite database is stored in a Docker volume (`gameclub-data`) for persistence.

## Testing

```bash
npm test           # Run tests once
npx vitest         # Run tests in watch mode
```

## Project Structure

```
src/
├── __tests__/
│   └── rcv.test.ts        # Ranked choice voting tests
├── app/
│   ├── api/
│   │   ├── elections/     # Create elections, submit ballots, close & tally
│   │   ├── games/         # Game CRUD & reviews
│   │   └── members/       # Member CRUD
│   ├── elections/         # Election history & detail pages
│   ├── history/           # Game history & detail with reviews
│   ├── members/           # Members list
│   ├── nominations/       # Nominations, ballot submission, election controls
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx           # Dashboard
├── components/
│   └── Navbar.tsx
└── lib/
    ├── db.ts              # SQLite connection & schema
    ├── rcv.ts             # Ranked choice voting algorithm
    ├── seed.ts            # Database seed script
    └── types.ts           # TypeScript types
```
