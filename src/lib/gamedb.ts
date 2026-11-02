import fs from "fs";
import type { components } from "@/lib/gamedb-contract/gamedb-v1";
// Client for the gamedb service. Reads GAMEDB_URL env (server-side only).
// gamedb is the homelab's authoritative game database service.

const BASE = process.env.GAMEDB_URL || "";

let cachedToken: string | null | undefined;

/**
 * Bearer token for GameDB service auth (game-db #107), from GAMEDB_TOKEN or the
 * file named by GAMEDB_TOKEN_FILE (a Docker secret). Read once per process.
 */
export function gamedbToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;
  const file = process.env.GAMEDB_TOKEN_FILE;
  if (file) {
    // A configured-but-missing secret is a deployment error; fail loudly.
    cachedToken = fs.readFileSync(file, "utf8").trim() || null;
  } else {
    cachedToken = process.env.GAMEDB_TOKEN?.trim() || null;
  }
  return cachedToken;
}

/** Reset the cached token (tests). */
export function resetGamedbTokenCache() {
  cachedToken = undefined;
}

/** fetch() against GameDB with the service token attached. Only used for BASE URLs. */
export function gamedbFetch(
  url: string,
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {}
): Promise<Response> {
  const token = gamedbToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

// Types are generated from GameDB's published v1 contract (game-club #163, game-db #105):
// src/lib/gamedb-contract/gamedb_v1.json is a pinned copy of game-db's openapi/v1.json and
// gamedb-v1.d.ts is generated from it with `npm run gen:gamedb`. Do not hand-edit either.
type Schemas = components["schemas"];
export type GamedbSearchResult = Schemas["SearchResult"];
export type GamedbDetail = Schemas["GameDetail"];

/** GameDB's versioned API root. */
const API = `${BASE}/api/v1`;

export function isGamedbConfigured(): boolean {
  return !!BASE;
}

export async function searchGamedb(
  q: string,
  pageSize = 10,
): Promise<GamedbSearchResult[]> {
  if (!BASE) throw new Error("GAMEDB_URL not configured");
  const url = new URL(`${API}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", String(pageSize));
  const res = await gamedbFetch(url.toString(), { next: { revalidate: 3600 } });
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
  const res = await gamedbFetch(`${API}/games/by-igdb/${id}`);
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
  const res = await gamedbFetch(
    `${API}/games/${id}`,
    options?.noCache
      ? { cache: "no-store" }
      : { next: { revalidate: 3600, tags: [gamedbDetailTag(gamedbId)] } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gamedb fetch failed: ${res.status}`);
  return (await res.json()) as GamedbDetail;
}

// Cache tag for a game's detail fetch; revalidated after a refresh.
export function gamedbDetailTag(gamedbId: number): string {
  return `gamedb-game-${gamedbId}`;
}

// Force gamedb to re-fetch upstream data (IGDB, OpenCritic, HLTB, Steam) for a game.
export async function refreshGamedb(gamedbId: number): Promise<GamedbDetail | null> {
  if (!BASE) throw new Error("GAMEDB_URL not configured");
  const id = safeIdSegment(gamedbId);
  const res = await gamedbFetch(`${API}/games/${id}/refresh`, { method: "POST", cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gamedb refresh failed: ${res.status}`);
  return (await res.json()) as GamedbDetail;
}

// Fetch several games in parallel; failures are logged and omitted so one bad
// row never breaks a page.
export async function getGamedbDetails(ids: number[]): Promise<Map<number, GamedbDetail>> {
  const out = new Map<number, GamedbDetail>();
  if (!BASE) return out;
  const unique = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))];
  const results = await Promise.allSettled(unique.map((id) => getGamedbDetail(id)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) out.set(unique[i], r.value);
    else if (r.status === "rejected") console.error(`gamedb lookup failed for ${unique[i]}:`, r.reason);
    else console.warn(`gamedb game ${unique[i]} not found; nomination is linked but has no gamedb record`);
  });
  return out;
}
