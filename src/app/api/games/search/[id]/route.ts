import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";

// Store ID → name mapping from RAWG
const STORE_NAMES: Record<number, string> = {
  1: "Steam",
  2: "Xbox Store",
  3: "PlayStation Store",
  4: "App Store",
  5: "GOG",
  6: "Nintendo Store",
  7: "Xbox 360 Store",
  8: "Google Play",
  9: "itch.io",
  11: "Epic Games",
};

// GET /api/games/search/[id] - fetch RAWG game details (stores + trailers)
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

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RAWG API not configured" },
      { status: 503 }
    );
  }

  const encodedId = encodeURIComponent(String(gid));

  try {
    // Fetch stores and movies in parallel
    const [storesRes, moviesRes] = await Promise.all([
      fetch(
        `https://api.rawg.io/api/games/${encodedId}/stores?key=${apiKey}`,
        { next: { revalidate: 86400 } } // cache 24h
      ),
      fetch(
        `https://api.rawg.io/api/games/${encodedId}/movies?key=${apiKey}`,
        { next: { revalidate: 86400 } }
      ),
    ]);

    // Parse stores
    let stores: { name: string; url: string; domain: string }[] = [];
    if (storesRes.ok) {
      const storesData = await storesRes.json();
      stores = (storesData.results || [])
        .filter(
          (s: { url: string; store_id: number }) => s.url && s.url.length > 0
        )
        .map((s: { url: string; store_id: number }) => ({
          name: STORE_NAMES[s.store_id] || `Store ${s.store_id}`,
          url: s.url,
          domain: new URL(s.url).hostname.replace("www.", ""),
        }));
    }

    // Parse trailers — get the first one with a video URL
    let trailerUrl = "";
    if (moviesRes.ok) {
      const moviesData = await moviesRes.json();
      const firstTrailer = (moviesData.results || [])[0];
      if (firstTrailer?.data?.max) {
        trailerUrl = firstTrailer.data.max;
      } else if (firstTrailer?.data?.["480"]) {
        trailerUrl = firstTrailer.data["480"];
      }
    }

    return NextResponse.json({ stores, trailerUrl });
  } catch (err) {
    console.error("RAWG detail fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch game details" },
      { status: 500 }
    );
  }
}
