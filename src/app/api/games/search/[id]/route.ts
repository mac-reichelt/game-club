import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { importByIgdbId, isGamedbConfigured } from "@/lib/gamedb";

// GET /api/games/search/[id] - store links for an IGDB game, via gamedb.
// gamedb owns all upstream metadata (IGDB); this app never calls IGDB itself.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Validate id is a positive integer to prevent URL manipulation
  const gid = parseInt(id, 10);
  if (!Number.isInteger(gid) || gid <= 0 || String(gid) !== id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!isGamedbConfigured()) {
    return NextResponse.json(
      { error: "Game details are not configured (missing GAMEDB_URL)" },
      { status: 503 }
    );
  }

  try {
    const detail = await importByIgdbId(gid);
    const stores = Object.entries(detail.store_links || {})
      .filter(([, url]) => typeof url === "string" && /^https?:\/\//.test(url))
      .map(([name, url]) => ({
        name,
        url,
        domain: new URL(url).hostname.replace("www.", ""),
      }));
    // gamedb does not expose trailers; the form keeps the field for manual entry.
    return NextResponse.json({ stores, trailerUrl: "" });
  } catch (err) {
    console.error("gamedb detail fetch error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Failed to fetch game details" },
      { status: 502 }
    );
  }
}
