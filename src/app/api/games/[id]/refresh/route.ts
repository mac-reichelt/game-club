import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { getGamedbDetail, isGamedbConfigured } from "@/lib/gamedb";

interface GameRow {
  id: number;
  gamedb_id: number | null;
}

function storeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// POST /api/games/[id]/refresh - refresh local game fields from gamedb
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromToken(request.cookies.get("session_token")?.value);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGamedbConfigured()) {
    return NextResponse.json(
      { error: "Game refresh is not configured (missing GAMEDB_URL)" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (!Number.isInteger(gameId) || gameId <= 0 || String(gameId) !== id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const game = db
    .prepare("SELECT id, gamedb_id FROM games WHERE id = ?")
    .get(gameId) as GameRow | undefined;
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (!game.gamedb_id) {
    return NextResponse.json(
      { error: "Game is not linked to gamedb" },
      { status: 400 }
    );
  }

  try {
    const detail = await getGamedbDetail(game.gamedb_id, { noCache: true });
    if (!detail) {
      return NextResponse.json(
        { error: "Game not found in gamedb" },
        { status: 404 }
      );
    }

    const stores = Object.entries(detail.store_links || {}).map(
      ([name, url]) => ({
        name,
        url,
        domain: storeDomain(url),
      })
    );

    db.prepare(
      "UPDATE games SET image_url = ?, stores_json = ? WHERE id = ?"
    ).run(detail.background_image || "", JSON.stringify(stores), gameId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("gamedb refresh failed:", err);
    return NextResponse.json(
      { error: "Failed to refresh game data" },
      { status: 500 }
    );
  }
}
