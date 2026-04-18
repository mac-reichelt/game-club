import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// GET /api/elections - list all elections
export async function GET(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
// Body: { gameIds: number[] }
export async function POST(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { gameIds, closesAt, autoCloseAtVotes } = body as {
    gameIds?: number[];
    closesAt?: string;
    autoCloseAtVotes?: number | null;
  };

  if (!gameIds || gameIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 games are required for an election" },
      { status: 400 }
    );
  }

  let closesAtSql: string | null = null;
  if (closesAt) {
    const d = new Date(closesAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid closesAt" }, { status: 400 });
    }
    if (d.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "closesAt must be in the future" },
        { status: 400 }
      );
    }
    // SQLite datetime() format: YYYY-MM-DD HH:MM:SS in UTC
    closesAtSql = d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  }

  let threshold: number | null = null;
  if (autoCloseAtVotes !== undefined && autoCloseAtVotes !== null) {
    const n = Number(autoCloseAtVotes);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json(
        { error: "autoCloseAtVotes must be a positive integer" },
        { status: 400 }
      );
    }
    threshold = n;
  }

  const openElection = db
    .prepare("SELECT id FROM elections WHERE status = 'open'")
    .get();
  if (openElection) {
    return NextResponse.json(
      {
        error:
          "An election is already open. Close it before starting a new one.",
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const name = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const result = closesAtSql
    ? db
        .prepare(
          "INSERT INTO elections (name, closes_at, auto_close_at_votes) VALUES (?, ?, ?)"
        )
        .run(name, closesAtSql, threshold)
    : db
        .prepare(
          "INSERT INTO elections (name, closes_at, auto_close_at_votes) VALUES (?, datetime('now', '+72 hours'), ?)"
        )
        .run(name, threshold);
  const electionId = result.lastInsertRowid;

  const insertGame = db.prepare(
    "INSERT INTO election_games (election_id, game_id) VALUES (?, ?)"
  );
  for (const gid of gameIds) {
    insertGame.run(electionId, gid);
  }

  return NextResponse.json({ id: electionId, name }, { status: 201 });
}
