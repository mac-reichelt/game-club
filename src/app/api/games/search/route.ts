import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { searchGamedb, isGamedbConfigured } from "@/lib/gamedb";

// GET /api/games/search?q=hades - search games via gamedb (backed by IGDB)
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
    return NextResponse.json(
      results.map((g) => ({
        igdbId: g.igdb_id,
        name: g.name,
        image: g.background_image,
        released: g.released,
        platforms: g.platforms.join(", "),
        genres: g.genres.join(", "),
        opencriticScore:
          g.opencritic?.top_critic_score != null && g.opencritic.top_critic_score > 0
            ? Math.round(g.opencritic.top_critic_score)
            : null,
        hltbMainHours: g.hltb?.main_story_hours ?? null,
      }))
    );
  } catch (err) {
    console.error("gamedb search error:", err);
    return NextResponse.json({ error: "Game search failed" }, { status: 502 });
  }
}
