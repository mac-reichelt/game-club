import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { tallyRankedChoice } from "@/lib/rcv";

// POST /api/elections/[id]/close - close an election and tally results
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const electionId = parseInt(id);

  const election = db
    .prepare("SELECT * FROM elections WHERE id = ? AND status = 'open'")
    .get(electionId);
  if (!election) {
    return NextResponse.json(
      { error: "Election not found or already closed" },
      { status: 404 }
    );
  }

  // Run ranked choice voting
  const result = tallyRankedChoice(db, electionId);

  // Save rounds to database
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

  // Update election
  db.prepare(
    "UPDATE elections SET status = 'closed', closed_at = datetime('now'), winner_id = ? WHERE id = ?"
  ).run(result.winnerId, electionId);

  // If there's a winner, promote it to "current" game
  if (result.winnerId) {
    // Mark any current game as completed
    db.prepare(
      "UPDATE games SET status = 'completed', completed_date = datetime('now') WHERE status = 'current'"
    ).run();

    // Promote winner
    db.prepare(
      "UPDATE games SET status = 'current', scheduled_date = datetime('now') WHERE id = ?"
    ).run(result.winnerId);
  }

  return NextResponse.json({
    winnerId: result.winnerId,
    rounds: result.rounds,
  });
}
