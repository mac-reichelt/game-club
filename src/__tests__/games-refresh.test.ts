import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserFromToken = vi.fn();
const mockIsGamedbConfigured = vi.fn();
const mockGetGamedbDetail = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn();

vi.mock("@/lib/auth", () => ({
  getUserFromToken: mockGetUserFromToken,
}));

vi.mock("@/lib/gamedb", () => ({
  isGamedbConfigured: mockIsGamedbConfigured,
  getGamedbDetail: mockGetGamedbDetail,
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

  it("refreshes image_url and stores_json from gamedb using no-store", async () => {
    mockGet.mockImplementation((sql: string) => {
      if (sql.includes("SELECT id, gamedb_id FROM games")) {
        return { id: 12, gamedb_id: 99 };
      }
      return null;
    });
    mockGetGamedbDetail.mockResolvedValue({
      id: 99,
      background_image: "https://example.com/image.jpg",
      store_links: {
        Steam: "https://store.steampowered.com/app/123",
        BadUrl: "not-a-url",
      },
    });

    const res = await callRoute("12");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
    expect(mockGetGamedbDetail).toHaveBeenCalledWith(99, { noCache: true });

    const updateCall = mockRun.mock.calls.find((call) =>
      String(call[0]).includes("UPDATE games SET image_url = ?, stores_json = ?")
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[1]).toBe("https://example.com/image.jpg");
    expect(updateCall?.[3]).toBe(12);

    const stores = JSON.parse(String(updateCall?.[2])) as Array<{
      name: string;
      domain: string;
    }>;
    expect(stores).toContainEqual({
      name: "Steam",
      url: "https://store.steampowered.com/app/123",
      domain: "store.steampowered.com",
    });
    expect(stores).toContainEqual({
      name: "BadUrl",
      url: "not-a-url",
      domain: "",
    });
  });
});
