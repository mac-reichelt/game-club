// Contract tests against GameDB's published v1 API (game-club #163, game-db #105).
// gamedb_v1.json is a pinned copy of game-db's openapi/v1.json; recorded.json holds
// real responses recorded read-only from a live GameDB. Update both together.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import spec from "@/lib/gamedb-contract/gamedb_v1.json";
import recorded from "@/lib/gamedb-contract/recorded.json";
import type { GamedbDetail, GamedbSearchResult } from "@/lib/gamedb";
import { buildGameInfo } from "@/lib/gameInfo";
import type { Game } from "@/lib/types";

const CONTRACT_DIR = path.join(__dirname, "..", "lib", "gamedb-contract");

// Compile-time check: recorded payloads must be assignable to the generated types.
const recordedGame: GamedbDetail = recorded.game;
const recordedSearch: GamedbSearchResult[] = recorded.search.results;

const paths = (spec as { paths: Record<string, Record<string, unknown>> }).paths;

function inContract(method: string, urlPath: string): boolean {
  return Object.entries(paths).some(([template, ops]) => {
    if (!(method in ops)) return false;
    const re = new RegExp("^" + template.replace(/\{[^/]+\}/g, "[^/]+") + "$");
    return re.test(urlPath);
  });
}

describe("GameDB v1 contract", () => {
  it("generated types are up to date with the pinned schema", () => {
    const sha = createHash("sha256").update(fs.readFileSync(path.join(CONTRACT_DIR, "gamedb_v1.json"))).digest("hex");
    const header = fs.readFileSync(path.join(CONTRACT_DIR, "gamedb-v1.d.ts"), "utf8").split("\n", 1)[0];
    expect(header, "run `npm run gen:gamedb`").toBe(`// gamedb_v1.json sha256: ${sha}`);
  });

  it("recorded payloads carry the fields game-club relies on", () => {
    expect(recordedGame.id).toBeGreaterThan(0);
    expect(recordedGame.name).toBeTruthy();
    expect(recordedSearch.length).toBeGreaterThan(0);
    expect(recordedSearch[0].igdb_id).toBeGreaterThan(0);
  });

  it("builds game info from a real GameDB payload", () => {
    const game = { id: 1, title: "x", gamedb_id: recordedGame.id } as Game;
    const info = buildGameInfo(game, recordedGame);
    expect(info.linked).toBe(true);
    expect(info.image).toMatch(/^https:\/\//);
    expect(info.description).toBe(recordedGame.description);
    if (recordedGame.opencritic?.top_critic_score) {
      expect(info.opencritic?.score).toBe(Math.round(recordedGame.opencritic.top_critic_score));
    }
    if (recordedGame.hltb?.main_story_hours != null) {
      expect(info.hltb?.mainStoryHours).toBe(recordedGame.hltb.main_story_hours);
    }
  });

  describe("client only calls published v1 endpoints", () => {
    const calls: { method: string; path: string }[] = [];

    beforeEach(() => {
      calls.length = 0;
      vi.resetModules();
      vi.stubEnv("GAMEDB_URL", "http://gamedb.test");
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ method: (init?.method || "GET").toLowerCase(), path: new URL(url).pathname });
          const body = new URL(url).pathname.endsWith("/search") ? recorded.search : recorded.game;
          return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        }),
      );
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("every gamedb.ts request matches the contract", async () => {
      const gamedb = await import("@/lib/gamedb");
      await gamedb.searchGamedb("dark souls");
      await gamedb.importByIgdbId(11133);
      await gamedb.getGamedbDetail(157);
      await gamedb.refreshGamedb(157);
      expect(calls).toHaveLength(4);
      for (const c of calls) expect(inContract(c.method, c.path), `${c.method} ${c.path}`).toBe(true);
    });
  });
});
