// Client for the gamedb service. Reads GAMEDB_URL env (server-side only).
// gamedb is the homelab's authoritative game database service.

const BASE = process.env.GAMEDB_URL || "";

export interface GamedbSearchResult {
  rawg_id: number;
  name: string;
  slug: string | null;
  released: string | null;
  background_image: string | null;
  platforms: string[];
  genres: string[];
  rating: number | null;
  metacritic: number | null;
}

export interface GamedbScore {
  score: number | null;
  tier: string | null;
}

export interface GamedbDetail {
  id: number;
  rawg_id: number;
  name: string;
  slug: string | null;
  release_date: string | null;
  description: string | null;
  background_image: string | null;
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
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

// Imports a game by RAWG id (auto-creates in gamedb) and returns the full
// detail record including the internal gamedb id.
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

export async function importByRawgId(rawgId: number): Promise<GamedbDetail> {
  if (!BASE) throw new Error("GAMEDB_URL not configured");
  const id = safeIdSegment(rawgId);
  const res = await fetch(`${BASE}/api/games/by-rawg/${id}`);
  if (!res.ok) throw new Error(`gamedb import failed: ${res.status}`);
  return (await res.json()) as GamedbDetail;
}

export async function getGamedbDetail(
  gamedbId: number,
): Promise<GamedbDetail | null> {
  if (!BASE) return null;
  let id: string;
  try {
    id = safeIdSegment(gamedbId);
  } catch {
    return null;
  }
  const res = await fetch(`${BASE}/api/games/${id}`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gamedb fetch failed: ${res.status}`);
  return (await res.json()) as GamedbDetail;
}
