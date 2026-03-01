import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { closeElectionAndTally } from "@/lib/elections";

// POST /api/elections/[id]/close - close an election and tally results
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Check if any votes were cast
  const voteCount = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT member_id) as count FROM ballots WHERE election_id = ?"
      )
      .get(electionId) as { count: number }
  ).count;

  if (voteCount === 0) {
    // Close without a winner
    db.prepare(
      "UPDATE elections SET status = 'closed', closed_at = datetime('now') WHERE id = ?"
    ).run(electionId);
    return NextResponse.json({ winnerId: null, rounds: [] });
  }

  try {
    const result = closeElectionAndTally(db, electionId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to close election" },
      { status: 500 }
    );
  }
}
