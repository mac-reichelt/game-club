import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

// POST /api/elections/[id]/ballot (game-club #162: missing route tests).

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

async function vote(id: number | string, body: unknown) {
  const { POST } = await import("@/app/api/elections/[id]/ballot/route");
  return POST(req(body), { params: Promise.resolve({ id: String(id) }) });
}

function openElection(opts: { closesAt?: string; autoClose?: number } = {}): number {
  const id = db
    .prepare("INSERT INTO elections (name, closes_at, auto_close_at_votes) VALUES ('E', ?, ?)")
    .run(opts.closesAt ?? null, opts.autoClose ?? null).lastInsertRowid as number;
  db.prepare("INSERT INTO election_games (election_id, game_id) VALUES (?, 1), (?, 2)").run(id, id);
  return id;
}

describe("POST /api/elections/[id]/ballot", () => {
  beforeEach(() => {
    db = schema();
    mockGetUserFromToken.mockReturnValue(member);
  });

  it("records a ranked ballot", async () => {
    const id = openElection();
    const res = await vote(id, { rankings: [2, 1] });
    expect(res.status).toBe(201);
    const rows = db.prepare("SELECT game_id, rank FROM ballots WHERE member_id = 2 ORDER BY rank").all();
    expect(rows).toEqual([{ game_id: 2, rank: 1 }, { game_id: 1, rank: 2 }]);
  });

  it("requires login and the vote permission", async () => {
    const id = openElection();
    mockGetUserFromToken.mockReturnValue(null);
    expect((await vote(id, { rankings: [1] })).status).toBe(401);
    mockGetUserFromToken.mockReturnValue({ ...member, permissions: [] });
    expect((await vote(id, { rankings: [1] })).status).toBe(403);
    expect(count("SELECT count(*) c FROM ballots")).toBe(0);
  });

  it("rejects bad ids, empty, duplicate, non-integer and foreign rankings", async () => {
    const id = openElection();
    expect((await vote("abc", { rankings: [1] })).status).toBe(400);
    expect((await vote(id, { rankings: [] })).status).toBe(400);
    expect((await vote(id, { rankings: [1, 1] })).status).toBe(400);
    expect((await vote(id, { rankings: ["1"] })).status).toBe(400);
    expect((await vote(id, { rankings: [3] })).status).toBe(400);
    expect(count("SELECT count(*) c FROM ballots")).toBe(0);
  });

  it("refuses a second ballot, closed elections and passed deadlines", async () => {
    const id = openElection();
    expect((await vote(id, { rankings: [1] })).status).toBe(201);
    expect((await vote(id, { rankings: [2] })).status).toBe(409);
    expect((await vote(999, { rankings: [1] })).status).toBe(404);
    const late = openElection({ closesAt: "2000-01-01 00:00:00" });
    expect((await vote(late, { rankings: [1] })).status).toBe(410);
  });

  it("auto-closes at the vote threshold", async () => {
    const id = openElection({ autoClose: 1 });
    const res = await vote(id, { rankings: [1, 2] });
    expect(res.status).toBe(201);
    expect((await res.json()).closed).toBeTruthy();
    expect(db.prepare("SELECT status FROM elections WHERE id = ?").get(id)).toEqual({ status: "closed" });
  });
});
