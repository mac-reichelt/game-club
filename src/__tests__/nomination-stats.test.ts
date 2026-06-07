import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { getNominationStats } from "@/app/nominations/nominationStats";

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      nominated_by INTEGER NOT NULL,
      nominated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'nominated'
    );
    CREATE TABLE elections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE election_games (
      election_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      PRIMARY KEY (election_id, game_id)
    );
  `);

  db.prepare("INSERT INTO members (name) VALUES ('Alice')").run();
  return db;
}

describe("getNominationStats", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("returns null first/last for nominated games never in an election", () => {
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO games (title, nominated_by, nominated_at, status) VALUES (?, ?, ?, 'nominated')"
      )
      .run("Fresh Nomination", 1, "2026-06-01T00:00:00Z");
    const gameId = Number(lastInsertRowid);

    const stats = getNominationStats(db);

    expect(stats[gameId].timesNominated).toBe(1);
    expect(stats[gameId].firstNominatedAt).toBeNull();
    expect(stats[gameId].lastNominatedAt).toBeNull();
  });

  it("uses election appearances for first/last/times nominated", () => {
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO games (title, nominated_by, nominated_at, status) VALUES (?, ?, ?, 'nominated')"
      )
      .run("Election Veteran", 1, "2026-06-01T00:00:00Z");
    const gameId = Number(lastInsertRowid);

    const { lastInsertRowid: electionA } = db
      .prepare("INSERT INTO elections (name, created_at) VALUES (?, ?)")
      .run("Election A", "2026-05-01T00:00:00Z");
    const { lastInsertRowid: electionB } = db
      .prepare("INSERT INTO elections (name, created_at) VALUES (?, ?)")
      .run("Election B", "2026-06-01T00:00:00Z");

    db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)")
      .run(Number(electionA), gameId);
    db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, ?)")
      .run(Number(electionB), gameId);

    const stats = getNominationStats(db);

    expect(stats[gameId].timesNominated).toBe(2);
    expect(stats[gameId].firstNominatedAt).toBe("2026-05-01T00:00:00Z");
    expect(stats[gameId].lastNominatedAt).toBe("2026-06-01T00:00:00Z");
  });
});
