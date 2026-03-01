/**
 * Seed the database with sample data.
 * Run with: npm run seed
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "gameclub.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL DEFAULT '🎮',
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

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_id, member_id)
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
`);

// Clear existing data
db.exec("DELETE FROM reviews; DELETE FROM votes; DELETE FROM games; DELETE FROM members;");

// Insert members
const insertMember = db.prepare(
  "INSERT INTO members (name, avatar, joined_at) VALUES (?, ?, ?)"
);
const members = [
  { name: "Alex", avatar: "⚔️", joined: "2025-01-15" },
  { name: "Jordan", avatar: "🧙", joined: "2025-01-15" },
  { name: "Sam", avatar: "🚀", joined: "2025-02-01" },
  { name: "Casey", avatar: "🐉", joined: "2025-02-10" },
  { name: "Riley", avatar: "🌟", joined: "2025-03-01" },
];

for (const m of members) {
  insertMember.run(m.name, m.avatar, m.joined);
}

// Insert games
const insertGame = db.prepare(
  `INSERT INTO games (title, platform, description, nominated_by, nominated_at, status, scheduled_date, completed_date, avg_rating)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

// Completed games
insertGame.run(
  "Hades",
  "PC / Switch",
  "Roguelike dungeon crawler from Supergiant Games. Fight your way out of the Underworld.",
  1,
  "2025-01-20",
  "completed",
  "2025-01-20",
  "2025-02-15",
  4.5
);

insertGame.run(
  "Celeste",
  "PC / Switch",
  "Precision platformer about climbing a mountain. Beautiful story about mental health.",
  2,
  "2025-02-20",
  "completed",
  "2025-02-20",
  "2025-03-20",
  4.8
);

insertGame.run(
  "Outer Wilds",
  "PC / PS5 / Xbox",
  "Explore a solar system stuck in a time loop. One of the best exploration games ever made.",
  3,
  "2025-04-01",
  "completed",
  "2025-04-01",
  "2025-05-01",
  4.2
);

// Current game
insertGame.run(
  "Disco Elysium",
  "PC / PS5",
  "RPG where you play a detective with amnesia. Incredible writing and world-building.",
  4,
  "2025-05-15",
  "current",
  "2025-06-01",
  null,
  null
);

// Nominated games
insertGame.run(
  "Baldur's Gate 3",
  "PC / PS5",
  "Epic D&D RPG. Massive, choice-driven adventure with incredible depth.",
  1,
  "2025-06-10",
  "nominated",
  null,
  null,
  null
);

insertGame.run(
  "Hollow Knight",
  "PC / Switch",
  "Metroidvania set in a vast underground kingdom of insects.",
  5,
  "2025-06-12",
  "nominated",
  null,
  null,
  null
);

insertGame.run(
  "Return of the Obra Dinn",
  "PC / Switch",
  "Deduction puzzle game. Figure out what happened to a missing ship's crew.",
  2,
  "2025-06-15",
  "nominated",
  null,
  null,
  null
);

insertGame.run(
  "Inscryption",
  "PC",
  "Card-based odyssey that blends deckbuilding with escape-room puzzles and psychological horror.",
  3,
  "2025-06-18",
  "nominated",
  null,
  null,
  null
);

// Insert votes for nominated games
const insertVote = db.prepare(
  "INSERT INTO votes (game_id, member_id) VALUES (?, ?)"
);

// BG3 gets lots of votes
insertVote.run(5, 1);
insertVote.run(5, 2);
insertVote.run(5, 3);
insertVote.run(5, 4);

// Hollow Knight gets some votes
insertVote.run(6, 1);
insertVote.run(6, 3);
insertVote.run(6, 5);

// Obra Dinn gets a couple votes
insertVote.run(7, 2);
insertVote.run(7, 4);

// Inscryption gets one vote
insertVote.run(8, 5);

// Insert reviews for completed games
const insertReview = db.prepare(
  "INSERT INTO reviews (game_id, member_id, rating, comment) VALUES (?, ?, ?, ?)"
);

// Hades reviews
insertReview.run(1, 1, 5, "Incredible gameplay loop. The story keeps you coming back.");
insertReview.run(1, 2, 4, "Great combat but got a bit repetitive for me after 50 hours.");
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
console.log("   - 5 members");
console.log("   - 8 games (3 completed, 1 current, 4 nominated)");
console.log("   - 10 votes");
console.log("   - 13 reviews");

db.close();
