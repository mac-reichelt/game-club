import type Database from "better-sqlite3";
import { tallyRankedChoice } from "./rcv";
import { Election, GameWithNominator } from "./types";

export function getOpenElectionData(db: Database.Database) {
  const election = db
    .prepare("SELECT * FROM elections WHERE status = 'open' LIMIT 1")
    .get() as Election | undefined;

  if (!election) return null;

  const games = db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM election_games eg
       JOIN games g ON eg.game_id = g.id
       JOIN members m ON g.nominated_by = m.id
       WHERE eg.election_id = ?`
    )
    .all(election.id) as GameWithNominator[];

  const voters = db
    .prepare("SELECT DISTINCT member_id FROM ballots WHERE election_id = ?")
    .all(election.id) as { member_id: number }[];

  return {
    election,
    games,
    voteCount: voters.length,
    voterIds: voters.map((v) => v.member_id),
  };
}

export class ElectionError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export interface ElectionCloseResult {
  winnerId: number | null;
  rounds: ReturnType<typeof tallyRankedChoice>["rounds"];
}

/**
 * Close an election atomically: re-check it is still open, run the RCV tally,
 * save rounds, update its status and promote the winner to "current".
 *
 * Runs in one IMMEDIATE transaction, so two concurrent closes (manual close,
 * vote threshold, deadline sweep) can't both tally and double-write rounds.
 * Returns null when the election wasn't open (already closed or missing).
 */
export function closeElection(
  db: Database.Database,
  electionId: number
): ElectionCloseResult | null {
  const run = db.transaction((): ElectionCloseResult | null => {
    const open = db
      .prepare("SELECT id FROM elections WHERE id = ? AND status = 'open'")
      .get(electionId);
    if (!open) return null;

    const voteCount = (
      db
        .prepare(
          "SELECT COUNT(DISTINCT member_id) as count FROM ballots WHERE election_id = ?"
        )
        .get(electionId) as { count: number }
    ).count;
    if (voteCount === 0) {
      db.prepare(
        "UPDATE elections SET status = 'closed', closed_at = datetime('now') WHERE id = ?"
      ).run(electionId);
      return { winnerId: null, rounds: [] };
    }

    const result = tallyRankedChoice(db, electionId);
    const insertRound = db.prepare(
      `INSERT INTO election_rounds (election_id, round_number, eliminated_game_id, summary)
       VALUES (?, ?, ?, ?)`
    );
    for (const round of result.rounds) {
      insertRound.run(
        electionId,
        round.roundNumber,
        round.eliminatedGameId,
        round.summary
      );
    }

    db.prepare(
      "UPDATE elections SET status = 'closed', closed_at = datetime('now'), winner_id = ? WHERE id = ?"
    ).run(result.winnerId, electionId);

    if (result.winnerId) {
      db.prepare(
        "UPDATE games SET status = 'completed', completed_date = datetime('now') WHERE status = 'current'"
      ).run();
      db.prepare(
        "UPDATE games SET status = 'current', scheduled_date = datetime('now') WHERE id = ?"
      ).run(result.winnerId);
    }
    return result;
  });
  return db.inTransaction ? run() : run.immediate();
}

/** Back-compat name; see closeElection. */
export const closeElectionAndTally = closeElection;

export interface CreateElectionInput {
  gameIds: unknown;
  closesAtSql: string | null;
  autoCloseAtVotes: number | null;
  name: string;
}

/**
 * Validate and create an election in one IMMEDIATE transaction: no election may
 * already be open, and every game id must be a distinct nominated game. Nothing
 * is written unless everything is valid, so a bad id can't leave a half-created
 * open election behind.
 */
export function createElection(
  db: Database.Database,
  input: CreateElectionInput
): { id: number; name: string } {
  const { gameIds } = input;
  if (
    !Array.isArray(gameIds) ||
    !gameIds.every((g) => Number.isSafeInteger(g) && (g as number) > 0)
  ) {
    throw new ElectionError("gameIds must be an array of game ids", 400);
  }
  const ids = gameIds as number[];
  if (new Set(ids).size !== ids.length) {
    throw new ElectionError("gameIds must not contain duplicates", 400);
  }
  if (ids.length < 2) {
    throw new ElectionError(
      "At least 2 games are required for an election",
      400
    );
  }

  const run = db.transaction(() => {
    if (db.prepare("SELECT id FROM elections WHERE status = 'open'").get()) {
      throw new ElectionError(
        "An election is already open. Close it before starting a new one.",
        409
      );
    }
    const placeholders = ids.map(() => "?").join(",");
    const valid = (
      db
        .prepare(
          `SELECT COUNT(*) as count FROM games WHERE status = 'nominated' AND id IN (${placeholders})`
        )
        .get(...ids) as { count: number }
    ).count;
    if (valid !== ids.length) {
      throw new ElectionError(
        "Every game must exist and still be nominated",
        400
      );
    }

    const result = input.closesAtSql
      ? db
          .prepare(
            "INSERT INTO elections (name, closes_at, auto_close_at_votes) VALUES (?, ?, ?)"
          )
          .run(input.name, input.closesAtSql, input.autoCloseAtVotes)
      : db
          .prepare(
            "INSERT INTO elections (name, closes_at, auto_close_at_votes) VALUES (?, datetime('now', '+72 hours'), ?)"
          )
          .run(input.name, input.autoCloseAtVotes);
    const electionId = Number(result.lastInsertRowid);
    const insertGame = db.prepare(
      "INSERT INTO election_games (election_id, game_id) VALUES (?, ?)"
    );
    for (const gid of ids) insertGame.run(electionId, gid);
    return { id: electionId, name: input.name };
  });
  return run.immediate();
}

/**
 * Check if an election has hit its auto-close vote threshold and close it
 * if so. Safe to call after every ballot insert.
 */
export function checkAndCloseOnVoteThreshold(
  db: Database.Database,
  electionId: number
) {
  const election = db
    .prepare(
      "SELECT id, auto_close_at_votes FROM elections WHERE id = ? AND status = 'open'"
    )
    .get(electionId) as
    | { id: number; auto_close_at_votes: number | null }
    | undefined;
  if (!election || !election.auto_close_at_votes) return false;

  const voteCount = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT member_id) as count FROM ballots WHERE election_id = ?"
      )
      .get(electionId) as { count: number }
  ).count;

  if (voteCount >= election.auto_close_at_votes) {
    return closeElection(db, electionId) !== null;
  }
  return false;
}

/**
 * Auto-close any elections that have passed their 72-hour deadline.
 */
export function checkAndCloseExpiredElections(db: Database.Database) {
  const expired = db
    .prepare(
      "SELECT id FROM elections WHERE status = 'open' AND closes_at IS NOT NULL AND closes_at <= datetime('now')"
    )
    .all() as { id: number }[];

  for (const { id } of expired) {
    // closeElection re-checks status inside its transaction and closes
    // without a winner when nobody voted.
    closeElection(db, id);
  }
}
