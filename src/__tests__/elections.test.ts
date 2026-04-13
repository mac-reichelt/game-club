import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { closeElectionAndTally, checkAndCloseExpiredElections } from "@/lib/elections";

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
      status TEXT NOT NULL DEFAULT 'nominated' CHECK(status IN ('nominated', 'current', 'completed')),
      scheduled_date TEXT,
      completed_date TEXT,
      avg_rating REAL
    );
    CREATE TABLE elections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      closes_at TEXT,
      winner_id INTEGER REFERENCES games(id)
    );
    CREATE TABLE election_games (
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      PRIMARY KEY (election_id, game_id)
    );
    CREATE TABLE ballots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id),
      game_id INTEGER NOT NULL REFERENCES games(id),
      rank INTEGER NOT NULL CHECK(rank >= 1),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(election_id, member_id, rank),
      UNIQUE(election_id, member_id, game_id)
    );
    CREATE TABLE election_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      eliminated_game_id INTEGER REFERENCES games(id),
      summary TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_id, member_id)
    );
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
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
  gameIds: number[],
  opts?: { closesAt?: string }
): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO elections (name, closes_at) VALUES (?, ?)")
    .run("Test Election", opts?.closesAt ?? null);
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

describe("closeElectionAndTally", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("closes election and records winner", () => {
    const members = addMembers(db, 3);
    const games = addGames(db, ["Hades", "Celeste"], members[0]);
    const electionId = createElection(db, games);

    castBallot(db, electionId, members[0], [games[0], games[1]]);
    castBallot(db, electionId, members[1], [games[0], games[1]]);
    castBallot(db, electionId, members[2], [games[1], games[0]]);

    const result = closeElectionAndTally(db, electionId);

    expect(result.winnerId).toBe(games[0]);

    // Election should be marked closed with winner
    const election = db
      .prepare("SELECT status, winner_id, closed_at FROM elections WHERE id = ?")
      .get(electionId) as { status: string; winner_id: number; closed_at: string };
    expect(election.status).toBe("closed");
    expect(election.winner_id).toBe(games[0]);
    expect(election.closed_at).toBeTruthy();
  });

  it("saves rounds to election_rounds table", () => {
    const members = addMembers(db, 5);
    const games = addGames(db, ["A", "B", "C"], members[0]);
    const electionId = createElection(db, games);

    castBallot(db, electionId, members[0], [games[0], games[1], games[2]]);
    castBallot(db, electionId, members[1], [games[0], games[2], games[1]]);
    castBallot(db, electionId, members[2], [games[1], games[0], games[2]]);
    castBallot(db, electionId, members[3], [games[1], games[2], games[0]]);
    castBallot(db, electionId, members[4], [games[2], games[0], games[1]]);

    closeElectionAndTally(db, electionId);

    const rounds = db
      .prepare("SELECT * FROM election_rounds WHERE election_id = ? ORDER BY round_number")
      .all(electionId) as { round_number: number; eliminated_game_id: number | null; summary: string }[];
    expect(rounds.length).toBeGreaterThanOrEqual(1);
    expect(rounds[0].round_number).toBe(1);
    expect(rounds[0].summary).toBeTruthy();
  });

  it("promotes winner to current game status", () => {
    const members = addMembers(db, 2);
    const games = addGames(db, ["Winner Game", "Loser Game"], members[0]);
    const electionId = createElection(db, games);

    castBallot(db, electionId, members[0], [games[0], games[1]]);
    castBallot(db, electionId, members[1], [games[0], games[1]]);

    closeElectionAndTally(db, electionId);

    const winner = db
      .prepare("SELECT status, scheduled_date FROM games WHERE id = ?")
      .get(games[0]) as { status: string; scheduled_date: string };
    expect(winner.status).toBe("current");
    expect(winner.scheduled_date).toBeTruthy();
  });

  it("demotes previously current game to completed", () => {
    const members = addMembers(db, 2);
    const games = addGames(db, ["Old Current", "New Winner"], members[0]);

    // Set first game as current
    db.prepare("UPDATE games SET status = 'current' WHERE id = ?").run(games[0]);

    const electionId = createElection(db, [games[1]]);
    castBallot(db, electionId, members[0], [games[1]]);
    castBallot(db, electionId, members[1], [games[1]]);

    closeElectionAndTally(db, electionId);

    const oldGame = db
      .prepare("SELECT status FROM games WHERE id = ?")
      .get(games[0]) as { status: string };
    expect(oldGame.status).toBe("completed");

    const newGame = db
      .prepare("SELECT status FROM games WHERE id = ?")
      .get(games[1]) as { status: string };
    expect(newGame.status).toBe("current");
  });

  it("handles election with no ballots (no winner)", () => {
    const members = addMembers(db, 1);
    const games = addGames(db, ["A", "B"], members[0]);
    const electionId = createElection(db, games);

    const result = closeElectionAndTally(db, electionId);

    expect(result.winnerId).toBeNull();
    const election = db
      .prepare("SELECT status, winner_id FROM elections WHERE id = ?")
      .get(electionId) as { status: string; winner_id: number | null };
    expect(election.status).toBe("closed");
    expect(election.winner_id).toBeNull();
  });
});

describe("checkAndCloseExpiredElections", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("closes expired elections with votes", () => {
    const members = addMembers(db, 2);
    const games = addGames(db, ["A", "B"], members[0]);
    // Set closes_at in the past
    const electionId = createElection(db, games, {
      closesAt: "2020-01-01T00:00:00",
    });

    castBallot(db, electionId, members[0], [games[0], games[1]]);
    castBallot(db, electionId, members[1], [games[0], games[1]]);

    checkAndCloseExpiredElections(db);

    const election = db
      .prepare("SELECT status, winner_id FROM elections WHERE id = ?")
      .get(electionId) as { status: string; winner_id: number | null };
    expect(election.status).toBe("closed");
    expect(election.winner_id).toBe(games[0]);
  });

  it("closes expired elections without votes (no winner)", () => {
    const members = addMembers(db, 1);
    const games = addGames(db, ["A"], members[0]);
    const electionId = createElection(db, games, {
      closesAt: "2020-01-01T00:00:00",
    });

    checkAndCloseExpiredElections(db);

    const election = db
      .prepare("SELECT status, winner_id FROM elections WHERE id = ?")
      .get(electionId) as { status: string; winner_id: number | null };
    expect(election.status).toBe("closed");
    expect(election.winner_id).toBeNull();
  });

  it("does not close elections that have not expired", () => {
    const members = addMembers(db, 1);
    const games = addGames(db, ["A"], members[0]);
    const electionId = createElection(db, games, {
      closesAt: "2099-12-31T23:59:59",
    });

    checkAndCloseExpiredElections(db);

    const election = db
      .prepare("SELECT status FROM elections WHERE id = ?")
      .get(electionId) as { status: string };
    expect(election.status).toBe("open");
  });

  it("does not close elections without closes_at", () => {
    const members = addMembers(db, 1);
    const games = addGames(db, ["A"], members[0]);
    const electionId = createElection(db, games);

    checkAndCloseExpiredElections(db);

    const election = db
      .prepare("SELECT status FROM elections WHERE id = ?")
      .get(electionId) as { status: string };
    expect(election.status).toBe("open");
  });
});
