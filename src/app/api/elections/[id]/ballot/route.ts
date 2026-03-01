import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { Election } from "@/lib/types";

// POST /api/elections/[id]/ballot - submit a ranked choice ballot
// Body: { rankings: number[] } (memberId comes from session)
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
  const body = await request.json();
  const { rankings } = body as { rankings: number[] };

  if (!rankings || rankings.length === 0) {
    return NextResponse.json(
      { error: "Rankings are required" },
      { status: 400 }
    );
  }

  // Check election is open
  const election = db
    .prepare("SELECT * FROM elections WHERE id = ? AND status = 'open'")
    .get(electionId) as Election | undefined;
  if (!election) {
    return NextResponse.json(
      { error: "Election not found or already closed" },
      { status: 404 }
    );
  }

  // Check deadline hasn't passed
  if (
    election.closes_at &&
    new Date(election.closes_at + "Z") <= new Date()
  ) {
    return NextResponse.json(
      { error: "Voting deadline has passed" },
      { status: 410 }
    );
  }

  // Check member hasn't already voted
  const existingBallot = db
    .prepare(
      "SELECT id FROM ballots WHERE election_id = ? AND member_id = ?"
    )
    .get(electionId, user.id);
  if (existingBallot) {
    return NextResponse.json(
      { error: "You have already voted in this election" },
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
      insertBallot.run(electionId, user.id, rankings[i], i + 1);
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
