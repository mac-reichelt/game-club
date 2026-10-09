import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/server
vi.mock("next/server", () => {
  return {
    NextRequest: class {
      cookies = { get: () => ({ value: "token" }) };
      nextUrl = { searchParams: new URLSearchParams() };
    },
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        body,
        status: init?.status ?? 200,
      }),
    },
  };
});

// Mock auth to always return a user
vi.mock("@/lib/auth", () => ({
  getUserFromToken: () => ({ id: 1, name: "Test User" }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, GAMEDB_URL: "http://gamedb:8000" };
  vi.resetModules();
  mockFetch.mockReset();
});

async function callRoute(id: string) {
  // Re-import to pick up current mocks
  const { GET } = await import("@/app/api/games/search/[id]/route");
  const request = {
    cookies: { get: () => ({ value: "token" }) },
  } as never;
  const context = { params: Promise.resolve({ id }) };
  return GET(request, context);
}

describe("GET /api/games/search/[id]", () => {
  it("returns 400 for a non-integer id string", async () => {
    const res = await callRoute("abc");
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("Invalid id");
  });

  it("returns 400 for a decimal (float) id", async () => {
    const res = await callRoute("1.5");
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero", async () => {
    const res = await callRoute("0");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a negative integer", async () => {
    const res = await callRoute("-5");
    expect(res.status).toBe(400);
  });

  it("returns 400 for id containing query-string characters", async () => {
    const res = await callRoute("?");
    expect(res.status).toBe(400);
  });

  it("returns 400 for id containing fragment characters", async () => {
    const res = await callRoute("#");
    expect(res.status).toBe(400);
  });

  it("calls gamedb by-igdb with only the validated integer in the URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ store_links: {} }),
    });

    await callRoute("42");

    const calledUrls = mockFetch.mock.calls.map((call) => call[0] as string);
    expect(calledUrls).toEqual(["http://gamedb:8000/api/games/by-igdb/42"]);
  });

  it("maps gamedb store_links to stores and drops non-http urls", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        store_links: {
          Steam: "https://store.steampowered.com/app/374320",
          Bad: "javascript:alert(1)",
        },
      }),
    });

    const res = await callRoute("11133");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      stores: [
        { name: "Steam", url: "https://store.steampowered.com/app/374320", domain: "store.steampowered.com" },
      ],
      trailerUrl: "",
    });
  });

  it("returns 503 when GAMEDB_URL is not set", async () => {
    delete process.env.GAMEDB_URL;
    const res = await callRoute("42");
    expect(res.status).toBe(503);
  });

  it("returns 502 when gamedb fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await callRoute("42");
    expect(res.status).toBe(502);
    consoleSpy.mockRestore();
  });

  it("returns 400 when id is an empty string", async () => {
    const res = await callRoute("");
    expect(res.status).toBe(400);
  });
});
