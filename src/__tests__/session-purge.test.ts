import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { purgeExpiredSessions } from "@/lib/auth";

// game-club #161: expired sessions are deleted instead of piling up.

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
  `);
  return db;
}

describe("purgeExpiredSessions", () => {
  it("deletes expired sessions in ISO and SQLite formats and keeps live ones", () => {
    const db = setupDb();
    const ins = db.prepare("INSERT INTO sessions (token, member_id, expires_at) VALUES (?, 1, ?)");
    const hour = 60 * 60 * 1000;
    ins.run("old-iso", new Date(Date.now() - hour).toISOString());
    ins.run("old-sqlite", "2020-01-01 00:00:00");
    ins.run("live-iso", new Date(Date.now() + hour).toISOString());
    ins.run("live-sqlite", "2999-01-01 00:00:00");

    expect(purgeExpiredSessions(db)).toBe(2);
    const left = (db.prepare("SELECT token FROM sessions ORDER BY token").all() as { token: string }[]).map((r) => r.token);
    expect(left).toEqual(["live-iso", "live-sqlite"]);
    expect(purgeExpiredSessions(db)).toBe(0);
  });
});
