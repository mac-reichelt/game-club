import type Database from "better-sqlite3";
import { tallyRankedChoice } from "./rcv";

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
