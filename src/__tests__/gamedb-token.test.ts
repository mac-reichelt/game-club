import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// game-db #107: GameDB calls carry the service token.

describe("gamedbFetch", () => {
  const fetchMock = vi.fn(async () => new Response("{}"));

  beforeEach(async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    delete process.env.GAMEDB_TOKEN;
    delete process.env.GAMEDB_TOKEN_FILE;
    (await import("@/lib/gamedb")).resetGamedbTokenCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  function sentAuth(): string | null {
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    return new Headers(init.headers).get("authorization");
  }

  it("sends no header when no token is configured", async () => {
    const { gamedbFetch } = await import("@/lib/gamedb");
    await gamedbFetch("http://gamedb/api/games/1");
    expect(sentAuth()).toBeNull();
  });

  it("uses GAMEDB_TOKEN", async () => {
    process.env.GAMEDB_TOKEN = "env-token";
    const { gamedbFetch } = await import("@/lib/gamedb");
    await gamedbFetch("http://gamedb/api/games/1", { method: "POST" });
    expect(sentAuth()).toBe("Bearer env-token");
  });

  it("reads GAMEDB_TOKEN_FILE", async () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gdb-")), "tok");
    fs.writeFileSync(f, "file-token\n");
    process.env.GAMEDB_TOKEN_FILE = f;
    const { gamedbFetch } = await import("@/lib/gamedb");
    await gamedbFetch("http://gamedb/api/search");
    expect(sentAuth()).toBe("Bearer file-token");
  });

  it("fails loudly when GAMEDB_TOKEN_FILE is missing", async () => {
    process.env.GAMEDB_TOKEN_FILE = "/nonexistent/gamedb-token";
    const { gamedbFetch } = await import("@/lib/gamedb");
    expect(() => gamedbFetch("http://gamedb/api/search")).toThrow();
  });
});
