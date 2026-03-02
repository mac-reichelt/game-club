# 🎮 Game Club

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

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d

# Or build manually
docker build -t gameclub .
docker run -p 3000:3000 -v gameclub-data:/app/data gameclub
```

The SQLite database is stored in a Docker volume (`gameclub-data`) for persistence.

## Project Structure

```
src/
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
