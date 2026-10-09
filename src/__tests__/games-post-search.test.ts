import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserFromToken = vi.fn();
const mockImport = vi.fn();
const mockSearch = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();

vi.mock("@/lib/auth", () => ({ getUserFromToken: mockGetUserFromToken }));
vi.mock("@/lib/gamedb", () => ({
  importByIgdbId: mockImport,
  searchGamedb: mockSearch,
  isGamedbConfigured: () => true,
}));
vi.mock("@/lib/db", () => ({
  default: vi.fn(() => ({
    prepare: (sql: string) => ({
      get: (...a: unknown[]) => mockGet(sql, ...a),
      run: (...a: unknown[]) => mockRun(sql, ...a),
      all: () => [],
    }),
  })),
}));

function req(body: unknown, raw = false) {
  return {
    cookies: { get: () => ({ value: "t" }) },
    json: async () => (raw ? JSON.parse(body as string) : body),
  } as never;
}

describe("POST /api/games", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetUserFromToken.mockReturnValue({ id: 1 });
    mockGet.mockReturnValue(undefined);
    mockRun.mockReturnValue({ lastInsertRowid: 7 });
  });
  const post = async (b: unknown, raw = false) => (await import("@/app/api/games/route")).POST(req(b, raw));

  it("rejects malformed JSON", async () => {
    expect((await post("{bad", true)).status).toBe(400);
  });
  it("rejects invalid igdbId", async () => {
    expect((await post({ igdbId: -1 })).status).toBe(400);
    expect((await post({ igdbId: "5" })).status).toBe(400);
  });
  it("returns 502 when gamedb import fails", async () => {
    mockImport.mockRejectedValue(new Error("down"));
    expect((await post({ igdbId: 5 })).status).toBe(502);
  });
  it("returns 409 for duplicate gamedb game", async () => {
    mockImport.mockResolvedValue({ id: 42, name: "Hades" });
    mockGet.mockReturnValue({ id: 1 });
    const res = await post({ igdbId: 5 });
    expect(res.status).toBe(409);
    expect(mockGet.mock.calls[0][0]).toContain("gamedb_id");
  });
  it("creates a linked nomination", async () => {
    mockImport.mockResolvedValue({ id: 42, name: "Hades" });
    const res = await post({ igdbId: 5, trailerUrl: "https://youtu.be/x" });
    expect(res.status).toBe(201);
    expect(mockRun.mock.calls[0]).toContain(42);
  });
  it("rejects non-https trailer URLs", async () => {
    expect((await post({ title: "X", trailerUrl: "javascript:alert(1)" })).status).toBe(400);
  });
});

describe("GET /api/games/search", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetUserFromToken.mockReturnValue({ id: 1 });
  });
  it("tolerates rows with missing platforms/genres", async () => {
    mockSearch.mockResolvedValue([
      { igdb_id: 1, name: "A", platforms: null, genres: undefined },
      { igdb_id: 2, name: "B", platforms: ["PC"], genres: ["RPG"], hltb: { main_story_hours: 10 } },
    ]);
    const { GET } = await import("@/app/api/games/search/route");
    const res = await GET({
      cookies: { get: () => ({ value: "t" }) },
      nextUrl: { searchParams: new URLSearchParams("q=ab") },
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].platforms).toBe("");
    expect(body[1].hltbMainHours).toBe(10);
  });
});
