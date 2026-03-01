import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const games = db
    .prepare(
      `SELECT g.*, m.name as nominatorName,
        (SELECT COUNT(*) FROM votes v WHERE v.game_id = g.id) as voteCount
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       ORDER BY g.nominated_at DESC`
    )
    .all();
  return NextResponse.json(games);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { title, platform, description, nominatedBy } = body;

  if (!title || !nominatedBy) {
    return NextResponse.json(
      { error: "Title and nominatedBy are required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      "INSERT INTO games (title, platform, description, nominated_by) VALUES (?, ?, ?, ?)"
    )
    .run(title, platform || "", description || "", nominatedBy);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
