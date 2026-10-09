import { describe, it, expect } from "vitest";
import { buildGameInfo, storesFromGamedb } from "@/lib/gameInfo";
import type { Game } from "@/lib/types";
import type { GamedbDetail } from "@/lib/gamedb";

const game: Game = {
  id: 1,
  title: "Hades",
  platform: "Local platform",
  description: "Local description",
  image_url: "",
  stores_json: JSON.stringify([{ name: "itch.io", url: "https://x.itch.io/y", domain: "x.itch.io" }]),
  trailer_url: "",
  nominated_by: 1,
  nominated_at: "2026-01-01",
  status: "nominated",
  scheduled_date: null,
  completed_date: null,
  avg_rating: null,
  gamedb_id: 7,
};

const detail = {
  id: 7,
  igdb_id: 113112,
  name: "Hades",
  slug: "hades",
  release_date: "2020-09-17",
  description: "From gamedb",
  background_image: "https://images.igdb.com/bg.jpg",
  cover_image: "https://images.igdb.com/cover.jpg",
  game_type: "game",
  platforms: ["PC", "Switch"],
  genres: [],
  developers: [],
  publishers: [],
  igdb_rating: 91.6,
  igdb_rating_count: 100,
  opencritic: { url: "https://opencritic.com/game/9/hades", top_critic_score: 93.4, percent_recommended: 98, tier: "Mighty" },
  steam: null,
  hltb: { main_story_hours: 22, main_extra_hours: null, completionist_hours: 95 },
  store_links: { steam: "https://store.steampowered.com/app/1145360", bad: "javascript:alert(1)" },
} as GamedbDetail;

describe("buildGameInfo", () => {
  it("uses only gamedb data for linked games", () => {
    const info = buildGameInfo(game, detail);
    expect(info.linked).toBe(true);
    expect(info.description).toBe("From gamedb");
    expect(info.platform).toBe("PC, Switch");
    expect(info.image).toBe("https://images.igdb.com/cover.jpg");
    expect(info.opencritic).toEqual({ score: 93, tier: "Mighty", url: "https://opencritic.com/game/9/hades" });
    expect(info.hltb).toEqual({ mainStoryHours: 22, mainExtraHours: null, completionistHours: 95 });
    expect(info.igdbRating).toBe(92);
    expect(info.stores.map((s) => s.name)).toEqual(["Steam"]);
  });

  it("falls back to club-entered fields for manual (unlinked) games", () => {
    const info = buildGameInfo({ ...game, gamedb_id: null }, null);
    expect(info.linked).toBe(false);
    expect(info.description).toBe("Local description");
    expect(info.stores).toHaveLength(1);
    expect(info.opencritic).toBeNull();
  });

  it("hides OpenCritic when there is no score", () => {
    const info = buildGameInfo(game, { ...detail, opencritic: { url: null, top_critic_score: -1, percent_recommended: null, tier: null } });
    expect(info.opencritic).toBeNull();
  });
});

describe("storesFromGamedb", () => {
  it("drops non-https links", () => {
    expect(storesFromGamedb({ gog: "https://www.gog.com/x", x: "http://insecure" })).toEqual([
      { name: "GOG", url: "https://www.gog.com/x", domain: "gog.com" },
    ]);
  });
});
