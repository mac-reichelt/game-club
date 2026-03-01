import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

// GET /api/games - list nominated games
export async function GET(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const games = db
    .prepare(
      `SELECT g.*, m.name as nominated_by_name
       FROM games g
       LEFT JOIN members m ON g.nominated_by = m.id
       ORDER BY g.nominated_at DESC`
    )
    .all();

  return NextResponse.json(games);
}

// POST /api/games - nominate a new game (uses session user)
// Body: { title, platform?, description? }
export async function POST(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { title, platform, description, storesJson, trailerUrl } = body;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  // Check for duplicate nomination
  const existing = db
    .prepare("SELECT id FROM games WHERE title = ? AND status = 'nominated'")
    .get(title);
  if (existing) {
    return NextResponse.json(
      { error: "This game has already been nominated" },
      { status: 409 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO games (title, platform, description, stores_json, trailer_url, nominated_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'nominated')`
    )
    .run(
      title,
      platform || null,
      description || null,
      storesJson || "",
      trailerUrl || "",
      user.id
    );

  return NextResponse.json(
    { id: result.lastInsertRowid, title, nominatedBy: user.id },
    { status: 201 }
  );
}
