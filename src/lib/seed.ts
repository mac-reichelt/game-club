/**
 * Seed the database with sample data.
 * Run with: npm run seed
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return `${salt}:${hash}`;
}

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "gameclub.db");
// Remove existing database so we start fresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL DEFAULT '🎮',
    password_hash TEXT NOT NULL DEFAULT '',
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    nominated_by INTEGER NOT NULL REFERENCES members(id),
    nominated_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'nominated' CHECK(status IN ('nominated', 'current', 'completed')),
    scheduled_date TEXT,
    completed_date TEXT,
    avg_rating REAL
  );

  CREATE TABLE IF NOT EXISTS elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    closes_at TEXT,
    winner_id INTEGER REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS election_games (
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    PRIMARY KEY (election_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS ballots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    game_id INTEGER NOT NULL REFERENCES games(id),
    rank INTEGER NOT NULL CHECK(rank >= 1),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(election_id, member_id, rank),
    UNIQUE(election_id, member_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS election_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    eliminated_game_id INTEGER REFERENCES games(id),
    summary TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

// ----- Members -----
// Default password for all seed members: "gameclub"
const defaultPasswordHash = hashPassword("gameclub");

const insertMember = db.prepare(
  "INSERT INTO members (name, avatar, password_hash, joined_at) VALUES (?, ?, ?, ?)"
);
const members = [
  { name: "Alex", avatar: "⚔️", joined: "2025-01-15" },
  { name: "Jordan", avatar: "🧙", joined: "2025-01-15" },
  { name: "Sam", avatar: "🚀", joined: "2025-02-01" },
  { name: "Casey", avatar: "🐉", joined: "2025-02-10" },
  { name: "Riley", avatar: "🌟", joined: "2025-03-01" },
];
for (const m of members) {
  insertMember.run(m.name, m.avatar, defaultPasswordHash, m.joined);
}

// ----- Games -----
const insertGame = db.prepare(
  `INSERT INTO games (title, platform, description, nominated_by, nominated_at, status, scheduled_date, completed_date, avg_rating)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

// Games that went through past elections (completed)
// Game 1: Hades
insertGame.run("Hades", "PC / Switch", "Roguelike dungeon crawler from Supergiant Games.", 1, "2025-01-20", "completed", "2025-02-01", "2025-02-28", null);
// Game 2: Celeste
insertGame.run("Celeste", "PC / Switch", "Precision platformer about climbing a mountain.", 2, "2025-01-22", "completed", "2025-03-01", "2025-03-31", null);
// Game 3: Outer Wilds
insertGame.run("Outer Wilds", "PC / PS5 / Xbox", "Explore a solar system stuck in a time loop.", 3, "2025-01-25", "completed", "2025-04-01", "2025-04-30", null);
// Game 4: Disco Elysium (current - won most recent election)
insertGame.run("Disco Elysium", "PC / PS5", "RPG detective game with incredible writing.", 4, "2025-03-10", "current", "2025-05-01", null, null);

// Games that lost in past elections (back to nominated)
// Game 5: Hollow Knight
insertGame.run("Hollow Knight", "PC / Switch", "Metroidvania in a vast underground kingdom of insects.", 5, "2025-01-20", "nominated", null, null, null);
// Game 6: Return of the Obra Dinn
insertGame.run("Return of the Obra Dinn", "PC / Switch", "Deduction puzzle: figure out what happened to a ship's crew.", 2, "2025-02-15", "nominated", null, null, null);

// Fresh nominations (never in an election yet)
// Game 7: Baldur's Gate 3
insertGame.run("Baldur's Gate 3", "PC / PS5", "Epic D&D RPG with incredible depth.", 1, "2025-05-10", "nominated", null, null, null);
// Game 8: Inscryption
insertGame.run("Inscryption", "PC", "Card-based odyssey blending deckbuilding with escape-room puzzles.", 3, "2025-05-12", "nominated", null, null, null);

// ----- Elections -----

// == Election 1: February 2025 ==
// Candidates: Hades(1), Celeste(2), Hollow Knight(5)
// Winner: Hades
db.prepare("INSERT INTO elections (name, status, created_at, closed_at, winner_id) VALUES (?, 'closed', ?, ?, ?)").run(
  "February 2025", "2025-01-28", "2025-01-30", 1
);
// Election games
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(1, 1);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(1, 2);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(1, 5);

// Ballots for election 1
const insertBallot = db.prepare(
  "INSERT INTO ballots (election_id, member_id, game_id, rank) VALUES (?, ?, ?, ?)"
);
// Alex: Hades > Celeste > Hollow Knight
insertBallot.run(1, 1, 1, 1); insertBallot.run(1, 1, 2, 2); insertBallot.run(1, 1, 5, 3);
// Jordan: Celeste > Hades > Hollow Knight
insertBallot.run(1, 2, 2, 1); insertBallot.run(1, 2, 1, 2); insertBallot.run(1, 2, 5, 3);
// Sam: Hades > Hollow Knight > Celeste
insertBallot.run(1, 3, 1, 1); insertBallot.run(1, 3, 5, 2); insertBallot.run(1, 3, 2, 3);
// Casey: Hollow Knight > Hades > Celeste
insertBallot.run(1, 4, 5, 1); insertBallot.run(1, 4, 1, 2); insertBallot.run(1, 4, 2, 3);

db.prepare("INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)").run(
  1, 1, 5, "Round 1: Hades: 2, Celeste: 1, Hollow Knight: 1. Eliminated: Hollow Knight."
);
db.prepare("INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)").run(
  1, 2, null, "Hades wins with 3/4 votes (majority)."
);

// == Election 2: March 2025 ==
// Candidates: Celeste(2), Hollow Knight(5), Outer Wilds(3)
// Winner: Celeste
db.prepare("INSERT INTO elections (name, status, created_at, closed_at, winner_id) VALUES (?, 'closed', ?, ?, ?)").run(
  "March 2025", "2025-02-28", "2025-03-02", 2
);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(2, 2);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(2, 5);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(2, 3);

// Ballots for election 2
// Alex: Celeste > Outer Wilds > Hollow Knight
insertBallot.run(2, 1, 2, 1); insertBallot.run(2, 1, 3, 2); insertBallot.run(2, 1, 5, 3);
// Jordan: Outer Wilds > Celeste > Hollow Knight
insertBallot.run(2, 2, 3, 1); insertBallot.run(2, 2, 2, 2); insertBallot.run(2, 2, 5, 3);
// Sam: Celeste > Hollow Knight > Outer Wilds
insertBallot.run(2, 3, 2, 1); insertBallot.run(2, 3, 5, 2); insertBallot.run(2, 3, 3, 3);
// Casey: Hollow Knight > Celeste > Outer Wilds
insertBallot.run(2, 4, 5, 1); insertBallot.run(2, 4, 2, 2); insertBallot.run(2, 4, 3, 3);

db.prepare("INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)").run(
  2, 1, 3, "Round 1: Celeste: 2, Outer Wilds: 1, Hollow Knight: 1. Eliminated: Hollow Knight."
);
db.prepare("INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)").run(
  2, 2, null, "Celeste wins with 3/4 votes (majority)."
);

// == Election 3: April 2025 ==
// Candidates: Outer Wilds(3), Hollow Knight(5), Obra Dinn(6)
// Winner: Outer Wilds
db.prepare("INSERT INTO elections (name, status, created_at, closed_at, winner_id) VALUES (?, 'closed', ?, ?, ?)").run(
  "April 2025", "2025-03-28", "2025-03-30", 3
);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(3, 3);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(3, 5);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(3, 6);

// Ballots for election 3
// Alex: Outer Wilds > Obra Dinn > Hollow Knight
insertBallot.run(3, 1, 3, 1); insertBallot.run(3, 1, 6, 2); insertBallot.run(3, 1, 5, 3);
// Jordan: Obra Dinn > Outer Wilds > Hollow Knight
insertBallot.run(3, 2, 6, 1); insertBallot.run(3, 2, 3, 2); insertBallot.run(3, 2, 5, 3);
// Sam: Outer Wilds > Hollow Knight > Obra Dinn
insertBallot.run(3, 3, 3, 1); insertBallot.run(3, 3, 5, 2); insertBallot.run(3, 3, 6, 3);
// Casey: Hollow Knight > Outer Wilds > Obra Dinn
insertBallot.run(3, 4, 5, 1); insertBallot.run(3, 4, 3, 2); insertBallot.run(3, 4, 6, 3);
// Riley: Outer Wilds > Obra Dinn > Hollow Knight
insertBallot.run(3, 5, 3, 1); insertBallot.run(3, 5, 6, 2); insertBallot.run(3, 5, 5, 3);

db.prepare("INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)").run(
  3, 1, null, "Outer Wilds wins with 3/5 votes (majority)."
);

// == Election 4: May 2025 ==
// Candidates: Disco Elysium(4), Hollow Knight(5), Obra Dinn(6)
// Winner: Disco Elysium
db.prepare("INSERT INTO elections (name, status, created_at, closed_at, winner_id) VALUES (?, 'closed', ?, ?, ?)").run(
  "May 2025", "2025-04-28", "2025-04-30", 4
);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(4, 4);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(4, 5);
db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)").run(4, 6);

// Ballots for election 4
// Alex: Disco Elysium > Obra Dinn > Hollow Knight
insertBallot.run(4, 1, 4, 1); insertBallot.run(4, 1, 6, 2); insertBallot.run(4, 1, 5, 3);
// Jordan: Obra Dinn > Disco Elysium > Hollow Knight
insertBallot.run(4, 2, 6, 1); insertBallot.run(4, 2, 4, 2); insertBallot.run(4, 2, 5, 3);
// Sam: Disco Elysium > Hollow Knight > Obra Dinn
insertBallot.run(4, 3, 4, 1); insertBallot.run(4, 3, 5, 2); insertBallot.run(4, 3, 6, 3);
// Casey: Hollow Knight > Disco Elysium > Obra Dinn
insertBallot.run(4, 4, 5, 1); insertBallot.run(4, 4, 4, 2); insertBallot.run(4, 4, 6, 3);
// Riley: Disco Elysium > Obra Dinn > Hollow Knight
insertBallot.run(4, 5, 4, 1); insertBallot.run(4, 5, 6, 2); insertBallot.run(4, 5, 5, 3);

db.prepare("INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary) VALUES (?, ?, ?, ?)").run(
  4, 1, null, "Disco Elysium wins with 3/5 votes (majority)."
);

// ----- Reviews (for completed games) -----
const insertReview = db.prepare(
  "INSERT INTO reviews (game_id, member_id, rating, comment) VALUES (?, ?, ?, ?)"
);

// Hades reviews
insertReview.run(1, 1, 5, "Incredible gameplay loop. The story keeps you coming back.");
insertReview.run(1, 2, 4, "Great combat but got a bit repetitive after 50 hours.");
insertReview.run(1, 3, 5, "Perfect game. Music, art, gameplay — all top tier.");
insertReview.run(1, 4, 4, "Loved the characters and voice acting.");

// Celeste reviews
insertReview.run(2, 1, 5, "The assist mode made it accessible while still being challenging.");
insertReview.run(2, 2, 5, "Cried at the summit. Beautiful game.");
insertReview.run(2, 3, 5, "Best platformer I've ever played.");
insertReview.run(2, 4, 4, "Tough but fair. The B-sides were brutal!");
insertReview.run(2, 5, 5, "The story really resonated with me.");

// Outer Wilds reviews
insertReview.run(3, 1, 4, "Mind-blowing exploration. Wish I could forget it and play again.");
insertReview.run(3, 2, 5, "Nothing else like it. Pure curiosity-driven gameplay.");
insertReview.run(3, 3, 3, "Got motion sick but the world design is incredible.");
insertReview.run(3, 4, 5, "The ending made everything click. Masterpiece.");

// Update avg ratings
for (const gameId of [1, 2, 3]) {
  const avg = db
    .prepare("SELECT AVG(rating) as avg FROM reviews WHERE game_id = ?")
    .get(gameId) as { avg: number };
  db.prepare("UPDATE games SET avg_rating = ? WHERE id = ?").run(avg.avg, gameId);
}

console.log("✅ Database seeded successfully!");
console.log("   - 5 members (password: gameclub)");
console.log("   - 8 games (3 completed, 1 current, 4 nominated)");
console.log("   - 4 closed elections with ranked choice ballots");
console.log("   - 13 reviews");

db.close();
