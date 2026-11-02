import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ensureRbac } from "@/lib/permissions";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "gameclub.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL DEFAULT '🎮',
      password_hash TEXT NOT NULL DEFAULT '',
      disabled INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      password_changed_at TEXT,
      deactivated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      stores_json TEXT NOT NULL DEFAULT '',
      trailer_url TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('account', 'ip')),
      attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup
      ON login_attempts(identifier, type, attempted_at);
  `);

  // Migrations for existing databases
  const memberCols = db
    .prepare("PRAGMA table_info(members)")
    .all() as { name: string }[];
  if (!memberCols.some((c) => c.name === "password_hash")) {
    db.exec(
      "ALTER TABLE members ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!memberCols.some((c) => c.name === "disabled")) {
    db.exec(
      "ALTER TABLE members ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!memberCols.some((c) => c.name === "password_changed_at")) {
    db.exec("ALTER TABLE members ADD COLUMN password_changed_at TEXT");
  }
  if (!memberCols.some((c) => c.name === "active")) {
    db.exec("ALTER TABLE members ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }
  if (!memberCols.some((c) => c.name === "deactivated_at")) {
    db.exec("ALTER TABLE members ADD COLUMN deactivated_at TEXT");
  }
  if (!memberCols.some((c) => c.name === "is_admin")) {
    db.exec(
      "ALTER TABLE members ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"
    );
  }
  ensureAdmin(db);
  ensureRbac(db);

  const electionCols = db
    .prepare("PRAGMA table_info(elections)")
    .all() as { name: string }[];
  if (!electionCols.some((c) => c.name === "closes_at")) {
    db.exec("ALTER TABLE elections ADD COLUMN closes_at TEXT");
  }

  const gameCols = db
    .prepare("PRAGMA table_info(games)")
    .all() as { name: string }[];
  if (!gameCols.some((c) => c.name === "stores_json")) {
    db.exec(
      "ALTER TABLE games ADD COLUMN stores_json TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!gameCols.some((c) => c.name === "trailer_url")) {
    db.exec(
      "ALTER TABLE games ADD COLUMN trailer_url TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!gameCols.some((c) => c.name === "gamedb_id")) {
    db.exec("ALTER TABLE games ADD COLUMN gamedb_id INTEGER");
  }

  if (!electionCols.some((c) => c.name === "auto_close_at_votes")) {
    db.exec("ALTER TABLE elections ADD COLUMN auto_close_at_votes INTEGER");
  }

  // games.avg_rating caches the review average; the review route keeps it current.
  // Recompute once per start so it can never drift (#158).
  db.exec(
    "UPDATE games SET avg_rating = (SELECT AVG(rating) FROM reviews WHERE reviews.game_id = games.id)"
  );
}

/**
 * Make sure the club has an admin (game-club #155). If nobody is admin yet,
 * the longest-standing enabled, active member (lowest id) becomes one. More
 * Legacy flag only: permissions now come from roles (lib/permissions.ts), and this
 * flag only seeds the initial Owner/Admin role assignment.
 */
export function ensureAdmin(db: Database.Database) {
  db.exec(`
    UPDATE members SET is_admin = 1
    WHERE id = (SELECT MIN(id) FROM members WHERE disabled = 0 AND active = 1)
      AND NOT EXISTS (SELECT 1 FROM members WHERE is_admin = 1)
  `);
}

export default getDb;
