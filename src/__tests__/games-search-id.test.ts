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
  process.env = { ...OLD_ENV, RAWG_API_KEY: "test-key" };
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

  it("calls RAWG with only the validated integer in the URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await callRoute("42");

    const calledUrls = mockFetch.mock.calls.map((call) => call[0] as string);
    expect(calledUrls.length).toBeGreaterThan(0);
    for (const url of calledUrls) {
      // URL should contain /games/42/ — no extra characters
      expect(url).toMatch(/\/games\/42\//);
      // Ensure the game ID segment contains only digits (no special chars injected)
      expect(url).toMatch(/\/games\/\d+\//);
    }
  });

  it("returns 400 when id is an empty string", async () => {
    const res = await callRoute("");
    expect(res.status).toBe(400);
  });
});
