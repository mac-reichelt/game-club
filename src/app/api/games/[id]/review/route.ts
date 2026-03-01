import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { memberId, rating, comment } = body;

  if (!memberId || !rating) {
    return NextResponse.json(
      { error: "memberId and rating are required" },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const gameId = parseInt(id);

  try {
    db.prepare(
      "INSERT INTO reviews (game_id, member_id, rating, comment) VALUES (?, ?, ?, ?)"
    ).run(gameId, memberId, rating, comment || "");

    // Update average rating
    const avg = db
      .prepare(
        "SELECT AVG(rating) as avg FROM reviews WHERE game_id = ?"
      )
      .get(gameId) as { avg: number };

    db.prepare("UPDATE games SET avg_rating = ? WHERE id = ?").run(
      avg.avg,
      gameId
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Already reviewed this game" },
      { status: 409 }
    );
  }
}
