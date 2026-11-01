import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { ensureAdmin } from "@/lib/db";

// game-club #155 (admin-only elections) and #156 (validated, atomic create/close).

let db: Database.Database;
const mockGetUserFromToken = vi.fn();

vi.mock("@/lib/auth", () => ({ getUserFromToken: mockGetUserFromToken }));
vi.mock("@/lib/db", async (orig) => ({
  ...(await orig<typeof import("@/lib/db")>()),
  default: () => db,
}));

function schema(): Database.Database {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(`
    CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL DEFAULT '', disabled INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1, is_admin INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE games (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      nominated_by INTEGER NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'nominated', scheduled_date TEXT, completed_date TEXT);
    CREATE TABLE elections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT, closes_at TEXT, auto_close_at_votes INTEGER, winner_id INTEGER REFERENCES games(id));
    CREATE TABLE election_games (election_id INTEGER NOT NULL REFERENCES elections(id),
      game_id INTEGER NOT NULL REFERENCES games(id), PRIMARY KEY (election_id, game_id));
    CREATE TABLE ballots (id INTEGER PRIMARY KEY AUTOINCREMENT, election_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL, game_id INTEGER NOT NULL, rank INTEGER NOT NULL,
      UNIQUE(election_id, member_id, rank), UNIQUE(election_id, member_id, game_id));
    CREATE TABLE election_rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, election_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL, eliminated_game_id INTEGER, summary TEXT NOT NULL DEFAULT '');
  `);
  d.prepare("INSERT INTO members (name) VALUES ('a'), ('b')").run();
  d.prepare("INSERT INTO games (title, nominated_by) VALUES ('G1', 1), ('G2', 1), ('G3', 1)").run();
  return d;
}

const admin = {
  id: 1,
  name: "a",
  avatar: "",
  joined_at: "",
  is_admin: true,
  permissions: ["elections.create", "elections.close", "elections.vote"],
};
const member = { ...admin, id: 2, name: "b", is_admin: false, permissions: ["elections.vote"] };

function req(body: unknown, raw = false) {
  return {
    cookies: { get: () => ({ value: "t" }) },
    json: async () => (raw ? JSON.parse(body as string) : body),
  } as never;
}

async function create(body: unknown, raw = false) {
  const { POST } = await import("@/app/api/elections/route");
  return POST(req(body, raw));
}

async function close(id: number) {
  const { POST } = await import("@/app/api/elections/[id]/close/route");
  return POST(req({}), { params: Promise.resolve({ id: String(id) }) });
}

const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;

describe("election routes", () => {
  beforeEach(() => {
    db = schema();
    mockGetUserFromToken.mockReturnValue(admin);
  });

  it("non-admins can't start or close elections", async () => {
    mockGetUserFromToken.mockReturnValue(member);
    expect((await create({ gameIds: [1, 2] })).status).toBe(403);
    db.prepare("INSERT INTO elections (name) VALUES ('x')").run();
    expect((await close(1)).status).toBe(403);
    expect(count("SELECT COUNT(*) c FROM elections WHERE status = 'open'")).toBe(1);
  });

  it("admin creates an election", async () => {
    const res = await create({ gameIds: [1, 2] });
    expect(res.status).toBe(201);
    expect(count("SELECT COUNT(*) c FROM election_games")).toBe(2);
  });

  it("malformed JSON is a 400, not a 500", async () => {
    expect((await create("{not json", true)).status).toBe(400);
  });

  it.each([
    [[1]],
    [[1, 1]],
    [[1, "2"]],
    [[1, 999]],
    ["1,2"],
  ])("rejects bad gameIds %j without leaving an election behind", async (gameIds) => {
    const res = await create({ gameIds });
    expect(res.status).toBe(400);
    expect(count("SELECT COUNT(*) c FROM elections")).toBe(0);
  });

  it("rejects games that aren't nominated", async () => {
    db.prepare("UPDATE games SET status = 'completed' WHERE id = 2").run();
    expect((await create({ gameIds: [1, 2] })).status).toBe(400);
    expect(count("SELECT COUNT(*) c FROM elections")).toBe(0);
  });

  it("refuses a second open election", async () => {
    expect((await create({ gameIds: [1, 2] })).status).toBe(201);
    expect((await create({ gameIds: [2, 3] })).status).toBe(409);
  });

  it("closing twice tallies once", async () => {
    await create({ gameIds: [1, 2] });
    db.prepare(
      "INSERT INTO ballots (election_id, member_id, game_id, rank) VALUES (1, 1, 1, 1), (1, 1, 2, 2)"
    ).run();
    expect((await close(1)).status).toBe(200);
    const rounds = count("SELECT COUNT(*) c FROM election_rounds");
    expect((await close(1)).status).toBe(404);
    expect(count("SELECT COUNT(*) c FROM election_rounds")).toBe(rounds);
    expect(
      (db.prepare("SELECT winner_id w FROM elections WHERE id = 1").get() as { w: number }).w
    ).toBe(1);
  });

  it("closing with no votes closes without a winner", async () => {
    await create({ gameIds: [1, 2] });
    const res = await close(1);
    expect(await res.json()).toEqual({ winnerId: null, rounds: [] });
  });
});

describe("ensureAdmin", () => {
  it("promotes the earliest enabled active member only when there is no admin", () => {
    const d = schema();
    d.prepare("UPDATE members SET disabled = 1 WHERE id = 1").run();
    ensureAdmin(d);
    expect(d.prepare("SELECT id FROM members WHERE is_admin = 1").all()).toEqual([{ id: 2 }]);
    d.prepare("UPDATE members SET disabled = 0 WHERE id = 1").run();
    ensureAdmin(d);
    expect(d.prepare("SELECT id FROM members WHERE is_admin = 1").all()).toEqual([{ id: 2 }]);
  });
});
