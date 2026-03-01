import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// GET /api/elections - list all elections
export async function GET() {
  const db = getDb();
  const elections = db
    .prepare(
      `SELECT e.*,
        g.title as winnerTitle,
        g.platform as winnerPlatform,
        (SELECT COUNT(DISTINCT b.member_id) FROM ballots b WHERE b.election_id = e.id) as ballotCount
       FROM elections e
       LEFT JOIN games g ON e.winner_id = g.id
       ORDER BY e.created_at DESC`
    )
    .all();
  return NextResponse.json(elections);
}

// POST /api/elections - create a new election
// Automatically names it "Game of the Month - <month> <year>"
// Body: { gameIds: number[] } - IDs of nominated games to include
export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { gameIds } = body as { gameIds?: number[] };

  if (!gameIds || gameIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 games are required for an election" },
      { status: 400 }
    );
  }

  // Check for already open election
  const openElection = db
    .prepare("SELECT id FROM elections WHERE status = 'open'")
    .get();
  if (openElection) {
    return NextResponse.json(
      { error: "An election is already open. Close it before starting a new one." },
      { status: 409 }
    );
  }

  const now = new Date();
  const name = `Game of the Month - ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const result = db
    .prepare("INSERT INTO elections (name) VALUES (?)")
    .run(name);
  const electionId = result.lastInsertRowid;

  const insertGame = db.prepare(
    "INSERT INTO election_games (election_id, game_id) VALUES (?, ?)"
  );
  for (const gid of gameIds) {
    insertGame.run(electionId, gid);
  }

  return NextResponse.json({ id: electionId, name }, { status: 201 });
}
