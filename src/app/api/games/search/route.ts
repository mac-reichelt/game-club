import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";

// GET /api/games/search?q=hades - search RAWG game database
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

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Game search is not configured (missing RAWG_API_KEY)" },
      { status: 503 }
    );
  }

  try {
    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("search", query);
    url.searchParams.set("page_size", "8");
    url.searchParams.set("search_precise", "true");

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      console.error("RAWG API error:", res.status, await res.text());
      return NextResponse.json(
        { error: "Game search failed" },
        { status: 502 }
      );
    }

    const data = await res.json();

    const results = (data.results || []).map(
      (game: {
        id: number;
        name: string;
        background_image: string | null;
        released: string | null;
        metacritic: number | null;
        platforms: { platform: { name: string } }[] | null;
        genres: { name: string }[] | null;
        short_screenshots: { image: string }[] | null;
      }) => ({
        id: game.id,
        name: game.name,
        image: game.background_image,
        released: game.released,
        metacritic: game.metacritic,
        platforms: (game.platforms || [])
          .map((p) => p.platform.name)
          .join(", "),
        genres: (game.genres || []).map((g) => g.name).join(", "),
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error("RAWG search error:", err);
    return NextResponse.json(
      { error: "Game search failed" },
      { status: 500 }
    );
  }
}
