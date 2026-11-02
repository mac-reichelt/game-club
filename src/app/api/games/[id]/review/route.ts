import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

// Ratings are 1-5 stars: this matches the review form and the reviews table CHECK.
const MIN_RATING = 1;
const MAX_RATING = 5;
const MAX_COMMENT_LENGTH = 2000;

// POST /api/games/[id]/review - submit or update the session user's review
// Body: { rating: integer 1-5, comment?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "games.review"))
    return NextResponse.json(
      { error: "You don't have permission to do that" },
      { status: 403 }
    );

  const { id } = await params;
  const gameId = Number(id);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { rating, comment } = (body ?? {}) as { rating?: unknown; comment?: unknown };

  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < MIN_RATING ||
    rating > MAX_RATING
  ) {
    return NextResponse.json(
      { error: `Rating must be a whole number from ${MIN_RATING} to ${MAX_RATING}` },
      { status: 400 }
    );
  }
  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    return NextResponse.json({ error: "Comment must be text" }, { status: 400 });
  }
  // The column is NOT NULL DEFAULT '': an empty comment is stored as "", never NULL (#158).
  const text = typeof comment === "string" ? comment.trim() : "";
  if (text.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be at most ${MAX_COMMENT_LENGTH} characters` },
      { status: 400 }
    );
  }

  const db = getDb();
  const game = db.prepare("SELECT id FROM games WHERE id = ?").get(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const created = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM reviews WHERE game_id = ? AND member_id = ?")
      .get(gameId, user.id);
    if (existing) {
      db.prepare(
        "UPDATE reviews SET rating = ?, comment = ? WHERE game_id = ? AND member_id = ?"
      ).run(rating, text, gameId, user.id);
    } else {
      db.prepare(
        "INSERT INTO reviews (game_id, member_id, rating, comment) VALUES (?, ?, ?, ?)"
      ).run(gameId, user.id, rating, text);
    }
    // games.avg_rating is the cached average the pages show; keep it in step.
    db.prepare(
      "UPDATE games SET avg_rating = (SELECT AVG(rating) FROM reviews WHERE game_id = ?) WHERE id = ?"
    ).run(gameId, gameId);
    return !existing;
  })();

  return NextResponse.json({ success: true }, { status: created ? 201 : 200 });
}
