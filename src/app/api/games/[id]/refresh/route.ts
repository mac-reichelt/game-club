import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { revalidateTag } from "next/cache";
import { refreshGamedb, isGamedbConfigured, gamedbDetailTag } from "@/lib/gamedb";

interface GameRow {
  id: number;
  gamedb_id: number | null;
}

// POST /api/games/[id]/refresh - ask gamedb to re-fetch upstream data.
// Game metadata lives only in gamedb, so nothing is written locally.
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
    const detail = await refreshGamedb(game.gamedb_id);
    if (!detail) {
      return NextResponse.json(
        { error: "Game not found in gamedb" },
        { status: 404 }
      );
    }
    // Drop the cached detail so pages show the refreshed data immediately.
    revalidateTag(gamedbDetailTag(game.gamedb_id), { expire: 0 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("gamedb refresh failed:", err);
    return NextResponse.json(
      { error: "Failed to refresh game data" },
      { status: 502 }
    );
  }
}
