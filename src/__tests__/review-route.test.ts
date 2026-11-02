import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

const mockGetUserFromToken = vi.fn();
let db: Database.Database;

vi.mock("@/lib/auth", () => ({ getUserFromToken: mockGetUserFromToken }));
vi.mock("@/lib/db", () => ({ default: vi.fn(() => db) }));

function setupDb() {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  // Mirrors src/lib/db.ts (reviews: rating 1-5, comment NOT NULL DEFAULT '').
  d.exec(`
    CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE games (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, avg_rating REAL);
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_id, member_id)
    );
    INSERT INTO members (name) VALUES ('a'), ('b');
    INSERT INTO games (title) VALUES ('Hades');
  `);
  return d;
}

async function post(id: string, body: unknown, raw = false) {
  const { POST } = await import("@/app/api/games/[id]/review/route");
  const request = {
    cookies: { get: () => ({ value: "t" }) },
    json: raw ? () => Promise.reject(new SyntaxError("bad json")) : () => Promise.resolve(body),
  } as never;
  return POST(request, { params: Promise.resolve({ id }) });
}

const avg = () => (db.prepare("SELECT avg_rating FROM games WHERE id = 1").get() as { avg_rating: number | null }).avg_rating;

describe("POST /api/games/[id]/review", () => {
  beforeEach(() => {
    vi.resetModules();
    db = setupDb();
    mockGetUserFromToken.mockReturnValue({ id: 1, name: "a", permissions: ["games.review"] });
  });

  it("saves a review without a comment and updates the average", async () => {
    const res = await post("1", { rating: 4 });
    expect(res.status).toBe(201);
    expect(db.prepare("SELECT rating, comment FROM reviews").get()).toEqual({ rating: 4, comment: "" });
    expect(avg()).toBe(4);
  });

  it("updates an existing review and averages across members", async () => {
    await post("1", { rating: 2, comment: "meh" });
    mockGetUserFromToken.mockReturnValue({ id: 2, name: "b", permissions: ["games.review"] });
    await post("1", { rating: 5 });
    mockGetUserFromToken.mockReturnValue({ id: 1, name: "a", permissions: ["games.review"] });
    const res = await post("1", { rating: 3, comment: "  better  " });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT comment FROM reviews WHERE member_id = 1").get()).toEqual({ comment: "better" });
    expect(avg()).toBe(4);
  });

  it.each([[0], [6], [3.5], ["4"], [null]])("rejects rating %s", async (rating) => {
    const res = await post("1", { rating });
    expect(res.status).toBe(400);
    expect(avg()).toBeNull();
  });

  it("rejects long or non-text comments, bad JSON and bad ids", async () => {
    expect((await post("1", { rating: 3, comment: "x".repeat(2001) })).status).toBe(400);
    expect((await post("1", { rating: 3, comment: 5 })).status).toBe(400);
    expect((await post("1", null, true)).status).toBe(400);
    expect((await post("abc", { rating: 3 })).status).toBe(400);
    expect((await post("99", { rating: 3 })).status).toBe(404);
  });

  it("requires login and the review permission", async () => {
    mockGetUserFromToken.mockReturnValue(null);
    expect((await post("1", { rating: 3 })).status).toBe(401);
    mockGetUserFromToken.mockReturnValue({ id: 1, name: "a", permissions: [] });
    expect((await post("1", { rating: 3 })).status).toBe(403);
  });
});
