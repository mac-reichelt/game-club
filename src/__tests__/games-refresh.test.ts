import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserFromToken = vi.fn();
const mockIsGamedbConfigured = vi.fn();
const mockRefreshGamedb = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn();

vi.mock("@/lib/auth", () => ({
  getUserFromToken: mockGetUserFromToken,
}));

vi.mock("@/lib/gamedb", () => ({
  isGamedbConfigured: mockIsGamedbConfigured,
  refreshGamedb: mockRefreshGamedb,
}));

vi.mock("@/lib/db", () => ({
  default: vi.fn(() => ({
    prepare: mockPrepare,
  })),
}));

async function callRoute(id: string) {
  const { POST } = await import("@/app/api/games/[id]/refresh/route");
  const request = {
    cookies: { get: () => ({ value: "session-token" }) },
  } as never;
  const context = { params: Promise.resolve({ id }) };
  return POST(request, context);
}

describe("POST /api/games/[id]/refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetUserFromToken.mockReturnValue({ id: 1, name: "Test User" });
    mockIsGamedbConfigured.mockReturnValue(true);
    mockPrepare.mockImplementation((sql: string) => ({
      get: (...args: unknown[]) => mockGet(sql, ...args),
      run: (...args: unknown[]) => mockRun(sql, ...args),
    }));
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserFromToken.mockReturnValue(null);
    const res = await callRoute("1");
    expect(res.status).toBe(401);
  });

  it("returns 503 when gamedb is not configured", async () => {
    mockIsGamedbConfigured.mockReturnValue(false);
    const res = await callRoute("1");
    expect(res.status).toBe(503);
  });

  it("returns 400 for invalid id", async () => {
    const res = await callRoute("abc");
    expect(res.status).toBe(400);
  });

  it("asks gamedb to refresh and writes nothing locally", async () => {
    mockGet.mockImplementation((sql: string) =>
      sql.includes("SELECT id, gamedb_id FROM games") ? { id: 12, gamedb_id: 99 } : null
    );
    mockRefreshGamedb.mockResolvedValue({ id: 99, store_links: {} });

    const res = await callRoute("12");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
    expect(mockRefreshGamedb).toHaveBeenCalledWith(99);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("returns 400 when the game is not linked to gamedb", async () => {
    mockGet.mockReturnValue({ id: 12, gamedb_id: null });
    const res = await callRoute("12");
    expect(res.status).toBe(400);
    expect(mockRefreshGamedb).not.toHaveBeenCalled();
  });

  it("returns 502 when gamedb refresh fails", async () => {
    mockGet.mockReturnValue({ id: 12, gamedb_id: 99 });
    mockRefreshGamedb.mockRejectedValue(new Error("boom"));
    const res = await callRoute("12");
    expect(res.status).toBe(502);
  });
});
