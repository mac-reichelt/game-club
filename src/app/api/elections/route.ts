import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { createElection, ElectionError } from "@/lib/elections";

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

// POST /api/elections - create a new election (admins only)
// Body: { gameIds: number[], closesAt?: string, autoCloseAtVotes?: number | null }
export async function POST(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.is_admin)
    return NextResponse.json(
      { error: "Only club admins can start elections" },
      { status: 403 }
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { gameIds, closesAt, autoCloseAtVotes } = body as {
    gameIds?: unknown;
    closesAt?: unknown;
    autoCloseAtVotes?: unknown;
  };

  let closesAtSql: string | null = null;
  if (closesAt !== undefined && closesAt !== null && closesAt !== "") {
    const d = typeof closesAt === "string" ? new Date(closesAt) : new Date(NaN);
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

  const now = new Date();
  const name = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  try {
    const created = createElection(getDb(), {
      gameIds,
      closesAtSql,
      autoCloseAtVotes: threshold,
      name,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof ElectionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to create election", err);
    return NextResponse.json(
      { error: "Failed to create election" },
      { status: 500 }
    );
  }
}
