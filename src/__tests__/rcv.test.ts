import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { tallyRankedChoice } from "@/lib/rcv";

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL DEFAULT '🎮',
      password_hash TEXT NOT NULL DEFAULT '',
      disabled INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      stores_json TEXT NOT NULL DEFAULT '',
      trailer_url TEXT NOT NULL DEFAULT '',
      nominated_by INTEGER NOT NULL REFERENCES members(id),
      nominated_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'nominated',
      scheduled_date TEXT,
      completed_date TEXT,
      avg_rating REAL
    );
    CREATE TABLE elections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      closes_at TEXT,
      winner_id INTEGER REFERENCES games(id)
    );
    CREATE TABLE election_games (
      election_id INTEGER NOT NULL REFERENCES elections(id),
      game_id INTEGER NOT NULL REFERENCES games(id),
      PRIMARY KEY (election_id, game_id)
    );
    CREATE TABLE ballots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL REFERENCES elections(id),
      member_id INTEGER NOT NULL REFERENCES members(id),
      game_id INTEGER NOT NULL REFERENCES games(id),
      rank INTEGER NOT NULL CHECK(rank >= 1),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(election_id, member_id, rank),
      UNIQUE(election_id, member_id, game_id)
    );
  `);
  return db;
}

function addMembers(db: Database.Database, count: number): number[] {
  const ids: number[] = [];
  for (let i = 1; i <= count; i++) {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO members (name) VALUES (?)")
      .run(`Member ${i}`);
    ids.push(Number(lastInsertRowid));
  }
  return ids;
}

function addGames(
  db: Database.Database,
  titles: string[],
  nominatedBy: number
): number[] {
  return titles.map((title) => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO games (title, nominated_by) VALUES (?, ?)")
      .run(title, nominatedBy);
    return Number(lastInsertRowid);
  });
}

function createElection(
  db: Database.Database,
  gameIds: number[]
): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO elections (name) VALUES (?)")
    .run("Test Election");
  const electionId = Number(lastInsertRowid);
  for (const gid of gameIds) {
    db.prepare(
      "INSERT INTO election_games (election_id, game_id) VALUES (?, ?)"
    ).run(electionId, gid);
  }
  return electionId;
}

function castBallot(
  db: Database.Database,
  electionId: number,
  memberId: number,
  rankedGameIds: number[]
) {
  for (let i = 0; i < rankedGameIds.length; i++) {
    db.prepare(
      "INSERT INTO ballots (election_id, member_id, game_id, rank) VALUES (?, ?, ?, ?)"
    ).run(electionId, memberId, rankedGameIds[i], i + 1);
  }
}

describe("tallyRankedChoice", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("returns no winner when there are no ballots", () => {
    const members = addMembers(db, 1);
    const games = addGames(db, ["Game A", "Game B"], members[0]);
    const electionId = createElection(db, games);

    const result = tallyRankedChoice(db, electionId);

    expect(result.winnerId).toBeNull();
    expect(result.rounds).toHaveLength(0);
  });

  it("declares winner with clear majority in round 1", () => {
    const members = addMembers(db, 3);
    const games = addGames(db, ["Hades", "Celeste", "Disco Elysium"], members[0]);
    const electionId = createElection(db, games);

    // 2 out of 3 voters pick Hades first
    castBallot(db, electionId, members[0], [games[0], games[1], games[2]]);
    castBallot(db, electionId, members[1], [games[0], games[2], games[1]]);
    castBallot(db, electionId, members[2], [games[1], games[0], games[2]]);

    const result = tallyRankedChoice(db, electionId);

    expect(result.winnerId).toBe(games[0]); // Hades
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].summary).toContain("Hades");
    expect(result.rounds[0].summary).toContain("majority");
  });

  it("eliminates lowest-vote candidate and redistributes", () => {
    const members = addMembers(db, 5);
    const games = addGames(db, ["A", "B", "C"], members[0]);
    const electionId = createElection(db, games);

    // A: 2 first-choice, B: 2 first-choice, C: 1 first-choice
    // C eliminated, its voter's 2nd choice is A -> A wins
    castBallot(db, electionId, members[0], [games[0], games[1], games[2]]);
    castBallot(db, electionId, members[1], [games[0], games[2], games[1]]);
    castBallot(db, electionId, members[2], [games[1], games[0], games[2]]);
    castBallot(db, electionId, members[3], [games[1], games[2], games[0]]);
    castBallot(db, electionId, members[4], [games[2], games[0], games[1]]);

    const result = tallyRankedChoice(db, electionId);

    expect(result.winnerId).toBe(games[0]); // A wins after redistribution
    expect(result.rounds.length).toBeGreaterThanOrEqual(2);
    // Round 1 should eliminate C
    expect(result.rounds[0].eliminatedGameId).toBe(games[2]);
  });

  it("handles two-candidate election", () => {
    const members = addMembers(db, 3);
    const games = addGames(db, ["X", "Y"], members[0]);
    const electionId = createElection(db, games);

    castBallot(db, electionId, members[0], [games[0], games[1]]);
    castBallot(db, electionId, members[1], [games[1], games[0]]);
    castBallot(db, electionId, members[2], [games[0], games[1]]);

    const result = tallyRankedChoice(db, electionId);

    expect(result.winnerId).toBe(games[0]); // X wins 2-1
    expect(result.rounds).toHaveLength(1);
  });

  it("handles single candidate", () => {
    const members = addMembers(db, 2);
    const games = addGames(db, ["Only Game"], members[0]);
    const electionId = createElection(db, games);

    castBallot(db, electionId, members[0], [games[0]]);
    castBallot(db, electionId, members[1], [games[0]]);

    const result = tallyRankedChoice(db, electionId);

    expect(result.winnerId).toBe(games[0]);
  });

  it("tie-breaks by eliminating highest game ID", () => {
    const members = addMembers(db, 4);
    const games = addGames(db, ["Alpha", "Beta", "Gamma", "Delta"], members[0]);
    const electionId = createElection(db, games);

    // Each game gets 1 first-choice vote — all tied
    castBallot(db, electionId, members[0], [games[0], games[1], games[2], games[3]]);
    castBallot(db, electionId, members[1], [games[1], games[0], games[2], games[3]]);
    castBallot(db, electionId, members[2], [games[2], games[0], games[1], games[3]]);
    castBallot(db, electionId, members[3], [games[3], games[0], games[1], games[2]]);

    const result = tallyRankedChoice(db, electionId);

    // With 4-way tie, highest ID (Delta = games[3]) eliminated first
    expect(result.rounds[0].eliminatedGameId).toBe(games[3]);
  });

  it("handles multiple elimination rounds", () => {
    const members = addMembers(db, 7);
    const games = addGames(db, ["A", "B", "C", "D"], members[0]);
    const electionId = createElection(db, games);

    // A: 3, B: 2, C: 1, D: 1 -> no majority (need >3.5)
    // C and D tied at 1 — D (higher ID) eliminated
    // Then C eliminated, its votes redistribute
    castBallot(db, electionId, members[0], [games[0], games[1], games[2], games[3]]);
    castBallot(db, electionId, members[1], [games[0], games[2], games[1], games[3]]);
    castBallot(db, electionId, members[2], [games[0], games[1], games[2], games[3]]);
    castBallot(db, electionId, members[3], [games[1], games[0], games[2], games[3]]);
    castBallot(db, electionId, members[4], [games[1], games[0], games[2], games[3]]);
    castBallot(db, electionId, members[5], [games[2], games[0], games[1], games[3]]);
    castBallot(db, electionId, members[6], [games[3], games[0], games[1], games[2]]);

    const result = tallyRankedChoice(db, electionId);

    expect(result.winnerId).not.toBeNull();
    expect(result.rounds.length).toBeGreaterThanOrEqual(2);
    // D should be eliminated first (tied with C at 1, higher ID)
    expect(result.rounds[0].eliminatedGameId).toBe(games[3]);
  });

  it("records correct vote counts in each round", () => {
    const members = addMembers(db, 3);
    const games = addGames(db, ["A", "B", "C"], members[0]);
    const electionId = createElection(db, games);

    castBallot(db, electionId, members[0], [games[0], games[1], games[2]]);
    castBallot(db, electionId, members[1], [games[1], games[0], games[2]]);
    castBallot(db, electionId, members[2], [games[2], games[0], games[1]]);

    const result = tallyRankedChoice(db, electionId);

    // Round 1: all tied at 1 each
    const r1 = result.rounds[0].counts;
    expect(r1[games[0]]).toBe(1);
    expect(r1[games[1]]).toBe(1);
    expect(r1[games[2]]).toBe(1);
  });

  it("handles exhausted ballots gracefully", () => {
    const members = addMembers(db, 3);
    const games = addGames(db, ["A", "B", "C"], members[0]);
    const electionId = createElection(db, games);

    // Member 3 only ranks C (no fallback)
    castBallot(db, electionId, members[0], [games[0], games[1], games[2]]);
    castBallot(db, electionId, members[1], [games[1], games[0], games[2]]);
    castBallot(db, electionId, members[2], [games[2]]); // exhausted after C eliminated

    const result = tallyRankedChoice(db, electionId);

    // Should still produce a winner
    expect(result.winnerId).not.toBeNull();
  });
});
