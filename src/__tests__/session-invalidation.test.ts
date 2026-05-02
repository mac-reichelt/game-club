/**
 * Tests for session invalidation on password change.
 *
 * These tests use in-memory SQLite databases (passed directly to the auth
 * helpers) so they run fully isolated from the real DB.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { invalidateAllSessions } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL DEFAULT '🎮',
      password_hash TEXT NOT NULL DEFAULT '',
      disabled INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      password_changed_at TEXT
    );

    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
  `);
  return db;
}

function insertMember(db: Database.Database, name: string): number {
  const result = db
    .prepare("INSERT INTO members (name, password_hash) VALUES (?, 'hash')")
    .run(name);
  return result.lastInsertRowid as number;
}

function insertSession(
  db: Database.Database,
  memberId: number,
  token: string,
  createdAtOffset = "+0 minutes"
): void {
  db.prepare(
    `INSERT INTO sessions (token, member_id, created_at, expires_at)
     VALUES (?, ?, datetime('now', ?), datetime('now', '+30 days'))`
  ).run(token, memberId, createdAtOffset);
}

function sessionCount(db: Database.Database, memberId: number): number {
  return (
    db
      .prepare("SELECT COUNT(*) as cnt FROM sessions WHERE member_id = ?")
      .get(memberId) as { cnt: number }
  ).cnt;
}

// ---------------------------------------------------------------------------
// invalidateAllSessions
// ---------------------------------------------------------------------------

describe("invalidateAllSessions", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("removes all sessions for the given member", () => {
    const memberId = insertMember(db, "alice");
    insertSession(db, memberId, "token-a");
    insertSession(db, memberId, "token-b");
    insertSession(db, memberId, "token-c");

    expect(sessionCount(db, memberId)).toBe(3);

    invalidateAllSessions(memberId, db);

    expect(sessionCount(db, memberId)).toBe(0);
  });

  it("does not remove sessions belonging to other members", () => {
    const aliceId = insertMember(db, "alice");
    const bobId = insertMember(db, "bob");

    insertSession(db, aliceId, "alice-token");
    insertSession(db, bobId, "bob-token");

    invalidateAllSessions(aliceId, db);

    expect(sessionCount(db, aliceId)).toBe(0);
    expect(sessionCount(db, bobId)).toBe(1);
  });

  it("is a no-op when the member has no sessions", () => {
    const memberId = insertMember(db, "alice");

    expect(() => invalidateAllSessions(memberId, db)).not.toThrow();
    expect(sessionCount(db, memberId)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Session validation: sessions created before password_changed_at are stale
// ---------------------------------------------------------------------------

describe("stale session detection via password_changed_at", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  /**
   * Simulate the validation query used by getMemberByToken.
   * Returns member_id if the session is valid, undefined otherwise.
   */
  function validateSession(token: string): { member_id: number } | undefined {
    return db
      .prepare(
        `SELECT s.member_id FROM sessions s
         JOIN members m ON m.id = s.member_id
         WHERE s.token = ?
           AND s.expires_at > datetime('now')
           AND (m.password_changed_at IS NULL OR s.created_at >= m.password_changed_at)`
      )
      .get(token) as { member_id: number } | undefined;
  }

  it("accepts a session when member has no password_changed_at", () => {
    const memberId = insertMember(db, "alice");
    insertSession(db, memberId, "my-token");

    expect(validateSession("my-token")).toBeDefined();
  });

  it("accepts a session created after password_changed_at", () => {
    const memberId = insertMember(db, "alice");
    // Mark password as changed 5 minutes ago.
    db.prepare(
      "UPDATE members SET password_changed_at = datetime('now', '-5 minutes') WHERE id = ?"
    ).run(memberId);
    // Insert a session created 1 minute ago (after the password change).
    insertSession(db, memberId, "fresh-token", "-1 minutes");

    expect(validateSession("fresh-token")).toBeDefined();
  });

  it("rejects a session created before password_changed_at", () => {
    const memberId = insertMember(db, "alice");
    // Insert a session first (10 minutes ago).
    insertSession(db, memberId, "old-token", "-10 minutes");
    // Then mark password as changed 5 minutes ago (after session was created).
    db.prepare(
      "UPDATE members SET password_changed_at = datetime('now', '-5 minutes') WHERE id = ?"
    ).run(memberId);

    expect(validateSession("old-token")).toBeUndefined();
  });

  it("accepts a session created at the exact same moment as password_changed_at", () => {
    const memberId = insertMember(db, "alice");
    const now = new Date().toISOString();
    // Set password_changed_at and session created_at to the same timestamp.
    db.prepare(
      "UPDATE members SET password_changed_at = ? WHERE id = ?"
    ).run(now, memberId);
    db.prepare(
      `INSERT INTO sessions (token, member_id, created_at, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).run("exact-token", memberId, now);

    expect(validateSession("exact-token")).toBeDefined();
  });
});
