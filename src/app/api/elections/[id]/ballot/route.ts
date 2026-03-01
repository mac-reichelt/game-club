import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

// POST /api/elections/[id]/ballot - submit a ranked choice ballot
// Body: { memberId: number, rankings: number[] }
// rankings is an ordered array of game IDs (index 0 = 1st choice)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const electionId = parseInt(id);
  const body = await request.json();
  const { memberId, rankings } = body as {
    memberId: number;
    rankings: number[];
  };

  if (!memberId || !rankings || rankings.length === 0) {
    return NextResponse.json(
      { error: "memberId and rankings are required" },
      { status: 400 }
    );
  }

  // Check election is open
  const election = db
    .prepare("SELECT * FROM elections WHERE id = ? AND status = 'open'")
    .get(electionId);
  if (!election) {
    return NextResponse.json(
      { error: "Election not found or already closed" },
      { status: 404 }
    );
  }

  // Check member hasn't already voted
  const existingBallot = db
    .prepare(
      "SELECT id FROM ballots WHERE election_id = ? AND member_id = ?"
    )
    .get(electionId, memberId);
  if (existingBallot) {
    return NextResponse.json(
      { error: "Member has already voted in this election" },
      { status: 409 }
    );
  }

  // Validate all games are in this election
  const electionGameIds = (
    db
      .prepare("SELECT game_id FROM election_games WHERE election_id = ?")
      .all(electionId) as { game_id: number }[]
  ).map((r) => r.game_id);

  for (const gid of rankings) {
    if (!electionGameIds.includes(gid)) {
      return NextResponse.json(
        { error: `Game ${gid} is not in this election` },
        { status: 400 }
      );
    }
  }

  // Insert ballot entries
  const insertBallot = db.prepare(
    "INSERT INTO ballots (election_id, member_id, game_id, rank) VALUES (?, ?, ?, ?)"
  );
  const insertMany = db.transaction((rankings: number[]) => {
    for (let i = 0; i < rankings.length; i++) {
      insertBallot.run(electionId, memberId, rankings[i], i + 1);
    }
  });

  try {
    insertMany(rankings);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit ballot" },
      { status: 500 }
    );
  }
}
