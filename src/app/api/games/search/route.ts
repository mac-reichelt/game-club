import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { searchGamedb, isGamedbConfigured } from "@/lib/gamedb";

// GET /api/games/search?q=hades - search games via gamedb (proxies RAWG)
export async function GET(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  if (!isGamedbConfigured()) {
    return NextResponse.json(
      { error: "Game search is not configured (missing GAMEDB_URL)" },
      { status: 503 }
    );
  }

  try {
    const results = await searchGamedb(query, 8);
    // Map to the shape the existing NominationForm expects.
    return NextResponse.json(
      results.map((g) => ({
        id: g.rawg_id,
        name: g.name,
        image: g.background_image,
        released: g.released,
        metacritic: g.metacritic,
        platforms: g.platforms.join(", "),
        genres: g.genres.join(", "),
      }))
    );
  } catch (err) {
    console.error("gamedb search error:", err);
    return NextResponse.json({ error: "Game search failed" }, { status: 502 });
  }
}
