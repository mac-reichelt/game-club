// View model for game metadata. gamedb is the single source of truth for
// game info; club-entered fields are only used for games not linked to gamedb
// (manual nominations).
import type { GamedbDetail } from "@/lib/gamedb";
import type { Game, StoreLink } from "@/lib/types";

export interface GameInfo {
  image: string;
  description: string;
  platform: string;
  released: string | null;
  stores: StoreLink[];
  opencritic: { score: number; tier: string | null; url: string | null } | null;
  hltb: { mainStoryHours: number | null; mainExtraHours: number | null; completionistHours: number | null } | null;
  igdbRating: number | null;
  linked: boolean;
}

const STORE_NAMES: Record<string, string> = {
  steam: "Steam",
  gog: "GOG",
  epic: "Epic Games",
  xbox: "Xbox Store",
  microsoft: "Xbox Store",
  playstation: "PlayStation Store",
  nintendo: "Nintendo Store",
  itch: "itch.io",
  apple: "App Store",
  ios: "App Store",
  android: "Google Play",
  amazon: "Amazon",
  google_play: "Google Play",
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function storesFromGamedb(links: Record<string, string> | undefined | null): StoreLink[] {
  return Object.entries(links || {})
    .filter(([, url]) => typeof url === "string" && /^https:\/\//.test(url))
    .map(([key, url]) => ({ name: STORE_NAMES[key] ?? key, url, domain: domainOf(url) }));
}

function parseLocalStores(json: string): StoreLink[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as StoreLink[]) : [];
  } catch {
    return [];
  }
}

export function buildGameInfo(game: Game, detail: GamedbDetail | null | undefined): GameInfo {
  if (!detail) {
    return {
      image: /^https:\/\//.test(game.image_url) ? game.image_url : "",
      description: game.description || "",
      platform: game.platform || "",
      released: null,
      stores: parseLocalStores(game.stores_json),
      opencritic: null,
      hltb: null,
      igdbRating: null,
      linked: false,
    };
  }
  const oc = detail.opencritic;
  const h = detail.hltb;
  const hasHltb = !!h && (h.main_story_hours != null || h.main_extra_hours != null || h.completionist_hours != null);
  return {
    image: detail.cover_image || detail.background_image || "",
    description: detail.description || "",
    platform: (detail.platforms || []).join(", "),
    released: detail.release_date,
    stores: storesFromGamedb(detail.store_links),
    opencritic:
      oc && oc.top_critic_score != null && oc.top_critic_score > 0
        ? { score: Math.round(oc.top_critic_score), tier: oc.tier, url: oc.url }
        : null,
    hltb: hasHltb
      ? { mainStoryHours: h!.main_story_hours, mainExtraHours: h!.main_extra_hours, completionistHours: h!.completionist_hours }
      : null,
    igdbRating: detail.igdb_rating != null ? Math.round(detail.igdb_rating) : null,
    linked: true,
  };
}

export async function loadGameInfos(games: Game[]): Promise<Record<number, GameInfo>> {
  const { getGamedbDetails } = await import("@/lib/gamedb");
  const details = await getGamedbDetails(games.map((g) => g.gamedb_id).filter((x): x is number => !!x));
  return Object.fromEntries(games.map((g) => [g.id, buildGameInfo(g, g.gamedb_id ? details.get(g.gamedb_id) : null)]));
}
