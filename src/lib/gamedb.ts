// Client for the gamedb service. Reads GAMEDB_URL env (server-side only).
// gamedb is the homelab's authoritative game database service.

const BASE = process.env.GAMEDB_URL || "";

export interface GamedbSearchResult {
  igdb_id: number;
  name: string;
  slug: string | null;
  released: string | null;
  background_image: string | null;
  platforms: string[];
  genres: string[];
  rating: number | null;
  game_type: string | null;
}

export interface GamedbScore {
  score: number | null;
  tier: string | null;
}

export interface GamedbDetail {
  id: number;
  igdb_id: number | null;
  rawg_id: number | null;
  name: string;
  slug: string | null;
  release_date: string | null;
  description: string | null;
  background_image: string | null;
  cover_image: string | null;
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
  igdb_rating: number | null;
  igdb_rating_count: number | null;
  rawg_rating: number | null;
  rawg_ratings_count: number | null;
  metacritic_score: number | null;
  opencritic: { tier: string | null; score: number | null } | null;
  steam: { app_id: number | null; review_score: number | null } | null;
  hltb: {
    main_story_hours: number | null;
    main_extra_hours: number | null;
    completionist_hours: number | null;
  } | null;
  store_links: Record<string, string>;
}

export function isGamedbConfigured(): boolean {
  return !!BASE;
}

export async function searchGamedb(
  q: string,
  pageSize = 10,
): Promise<GamedbSearchResult[]> {
  if (!BASE) throw new Error("GAMEDB_URL not configured");
  const url = new URL(`${BASE}/api/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", String(pageSize));
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`gamedb search failed: ${res.status}`);
  const data = (await res.json()) as { results: GamedbSearchResult[] };
  return data.results || [];
}

// Validates a positive integer id and returns it as a digits-only string
// suitable for safe URL path interpolation. The regex test is a CodeQL
// recognized sanitizer for SSRF (js/request-forgery).
function safeIdSegment(id: number): string {
  const s = String(id);
  if (!/^[1-9][0-9]{0,14}$/.test(s)) {
    throw new Error("Invalid id");
  }
  return s;
}

// Imports a game by IGDB id (auto-creates in gamedb) and returns the full
// detail record including the internal gamedb id.
export async function importByIgdbId(igdbId: number): Promise<GamedbDetail> {
  if (!BASE) throw new Error("GAMEDB_URL not configured");
  const id = safeIdSegment(igdbId);
  const res = await fetch(`${BASE}/api/games/by-igdb/${id}`);
  if (!res.ok) throw new Error(`gamedb import failed: ${res.status}`);
  return (await res.json()) as GamedbDetail;
}

export async function getGamedbDetail(
  gamedbId: number,
  options?: { noCache?: boolean },
): Promise<GamedbDetail | null> {
  if (!BASE) return null;
  let id: string;
  try {
    id = safeIdSegment(gamedbId);
  } catch {
    return null;
  }
  const res = await fetch(
    `${BASE}/api/games/${id}`,
    options?.noCache ? { cache: "no-store" } : { next: { revalidate: 3600 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gamedb fetch failed: ${res.status}`);
  return (await res.json()) as GamedbDetail;
}
