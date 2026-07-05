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

/**
 * Close an election: run RCV tally, save rounds, update election status,
 * and promote the winner to "current" game.
 */
export function closeElectionAndTally(
  db: Database.Database,
  electionId: number
) {
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
    closeElectionAndTally(db, electionId);
    return true;
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
    const voteCount = (
      db
        .prepare(
          "SELECT COUNT(DISTINCT member_id) as count FROM ballots WHERE election_id = ?"
        )
        .get(id) as { count: number }
    ).count;

    if (voteCount > 0) {
      closeElectionAndTally(db, id);
    } else {
      // Close without a winner if no votes were cast
      db.prepare(
        "UPDATE elections SET status = 'closed', closed_at = datetime('now') WHERE id = ?"
      ).run(id);
    }
  }
}
