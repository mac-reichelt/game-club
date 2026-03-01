import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

// POST /api/games/[id]/review - submit a review (uses session user)
// Body: { rating, comment? }
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
  const gameId = parseInt(id);
  const body = await request.json();
  const { rating, comment } = body;

  if (!rating || rating < 1 || rating > 10) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 10" },
      { status: 400 }
    );
  }

  // Check game exists
  const game = db.prepare("SELECT id FROM games WHERE id = ?").get(gameId);
  if (!game) {
    return NextResponse.json(
      { error: "Game not found" },
      { status: 404 }
    );
  }

  // Upsert review
  const existing = db
    .prepare("SELECT id FROM reviews WHERE game_id = ? AND member_id = ?")
    .get(gameId, user.id);

  if (existing) {
    db.prepare(
      "UPDATE reviews SET rating = ?, comment = ? WHERE game_id = ? AND member_id = ?"
    ).run(rating, comment || null, gameId, user.id);
  } else {
    db.prepare(
      "INSERT INTO reviews (game_id, member_id, rating, comment) VALUES (?, ?, ?, ?)"
    ).run(gameId, user.id, rating, comment || null);
  }

  return NextResponse.json({ success: true }, { status: existing ? 200 : 201 });
}
