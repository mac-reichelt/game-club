# 🎮 Game Club

A web app for managing a game club — like a book club, but for games. Nominate games, vote on what to play next, track your history, and leave reviews.

## Features

- **Dashboard** — See what's currently being played, top nominations, and recently completed games
- **Nominations** — Nominate games and vote on what the club should play next
- **History** — Browse all completed games with ratings and reviews
- **Members** — Manage club members and see their activity stats

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [SQLite](https://www.sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

## Development

This project uses a **Dev Container** for development. Open the project in VS Code and use the "Reopen in Container" command, or:

```bash
# Install dependencies
npm install

# Seed the database with sample data
npm run seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── games/        # Game CRUD, voting, reviews, promotion
│   │   └── members/      # Member CRUD
│   ├── history/          # Game history & detail pages
│   ├── members/          # Members list page
│   ├── nominations/      # Nominations & voting page
│   ├── globals.css       # Global styles & CSS variables
│   ├── layout.tsx        # Root layout with sidebar nav
│   └── page.tsx          # Dashboard
├── components/
│   └── Navbar.tsx        # Sidebar navigation
└── lib/
    ├── db.ts             # SQLite database connection & schema
    ├── seed.ts           # Database seed script
    └── types.ts          # TypeScript type definitions
```
