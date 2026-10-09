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

// POST /api/games - nominate a game (uses session user)
// Body (search path): { igdbId, trailerUrl? } - game info comes from gamedb.
// Body (manual path): { title, platform?, description?, storesJson?, trailerUrl? }
//   for games gamedb/IGDB doesn't know about.
export async function POST(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { platform, description, storesJson, trailerUrl, igdbId } = body;
  let title: string = typeof body.title === "string" ? body.title.trim() : "";

  let gamedbId: number | null = null;
  if (igdbId !== undefined && igdbId !== null) {
    if (!Number.isInteger(igdbId) || igdbId <= 0) {
      return NextResponse.json({ error: "Invalid igdbId" }, { status: 400 });
    }
    try {
      const { importByIgdbId } = await import("@/lib/gamedb");
      const detail = await importByIgdbId(igdbId);
      gamedbId = detail.id;
      title = detail.name;
    } catch (err) {
      console.error("gamedb import failed:", err);
      return NextResponse.json(
        { error: "Could not load this game from gamedb. Try again or enter it manually." },
        { status: 502 }
      );
    }
  }

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  // Check for duplicate nomination (same gamedb game, or same title for manual entries)
  const existing = gamedbId
    ? db.prepare("SELECT id FROM games WHERE gamedb_id = ? AND status = 'nominated'").get(gamedbId)
    : db.prepare("SELECT id FROM games WHERE title = ? AND status = 'nominated'").get(title);
  if (existing) {
    return NextResponse.json(
      { error: "This game has already been nominated" },
      { status: 409 }
    );
  }

  // Linked games store only the title (for display/search) and club fields;
  // all other game info is read from gamedb at display time.
  const result = db
    .prepare(
      `INSERT INTO games (title, platform, description, stores_json, trailer_url, nominated_by, status, gamedb_id)
       VALUES (?, ?, ?, ?, ?, ?, 'nominated', ?)`
    )
    .run(
      title,
      gamedbId ? "" : platform || "",
      gamedbId ? "" : description || "",
      gamedbId ? "" : storesJson || "",
      typeof trailerUrl === "string" ? trailerUrl : "",
      user.id,
      gamedbId
    );

  return NextResponse.json(
    { id: result.lastInsertRowid, title, nominatedBy: user.id, gamedbId },
    { status: 201 }
  );
}
