import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  isAccountLocked,
  isIpThrottled,
  recordLoginAttempt,
  recordIpAttempt,
  resetLoginAttempts,
  cleanupOldLoginAttempts,
  checkAndRecordAttempt,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('account', 'ip')),
      attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

/** Insert `n` account-type attempt records for `name`, optionally at an offset. */
function insertAccountAttempts(
  db: Database.Database,
  name: string,
  n: number,
  offsetMinutes = 0
): void {
  const stmt = db.prepare(
    `INSERT INTO login_attempts (identifier, type, attempted_at)
     VALUES (?, 'account', datetime('now', ?))`
  );
  for (let i = 0; i < n; i++) {
    stmt.run(name, `${offsetMinutes} minutes`);
  }
}

/** Insert `n` ip-type attempt records for `ip`, optionally at an offset. */
function insertIpAttempts(
  db: Database.Database,
  ip: string,
  n: number,
  offsetMinutes = 0
): void {
  const stmt = db.prepare(
    `INSERT INTO login_attempts (identifier, type, attempted_at)
     VALUES (?, 'ip', datetime('now', ?))`
  );
  for (let i = 0; i < n; i++) {
    stmt.run(ip, `${offsetMinutes} minutes`);
  }
}

// ---------------------------------------------------------------------------
// isAccountLocked
// ---------------------------------------------------------------------------

describe("isAccountLocked", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("returns false when there are no attempts", () => {
    expect(isAccountLocked("alice", db)).toBe(false);
  });

  it("returns false when failed attempts are below the threshold (9)", () => {
    insertAccountAttempts(db, "alice", 9);
    expect(isAccountLocked("alice", db)).toBe(false);
  });

  it("returns true when there are exactly 10 recent failed attempts (threshold reached)", () => {
    insertAccountAttempts(db, "alice", 10);
    expect(isAccountLocked("alice", db)).toBe(true);
  });

  it("the 11th attempt is rejected (account is locked after 10 failures)", () => {
    // Simulate 10 failures already recorded.
    insertAccountAttempts(db, "alice", 10);
    // isAccountLocked returning true means the 11th attempt will be rejected.
    expect(isAccountLocked("alice", db)).toBe(true);
  });

  it("does not lock when all attempts are outside the 10-minute window", () => {
    insertAccountAttempts(db, "alice", 10, -11); // 11 minutes ago
    expect(isAccountLocked("alice", db)).toBe(false);
  });

  it("does not affect a different account", () => {
    insertAccountAttempts(db, "alice", 10);
    expect(isAccountLocked("bob", db)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isIpThrottled
// ---------------------------------------------------------------------------

describe("isIpThrottled", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("returns false when there are no attempts", () => {
    expect(isIpThrottled("1.2.3.4", db)).toBe(false);
  });

  it("returns false when attempts are below the threshold (29)", () => {
    insertIpAttempts(db, "1.2.3.4", 29);
    expect(isIpThrottled("1.2.3.4", db)).toBe(false);
  });

  it("returns true when there are exactly 30 recent attempts (threshold reached)", () => {
    insertIpAttempts(db, "1.2.3.4", 30);
    expect(isIpThrottled("1.2.3.4", db)).toBe(true);
  });

  it("per-IP cap fires: the 31st attempt from the same IP is rejected", () => {
    insertIpAttempts(db, "1.2.3.4", 30);
    expect(isIpThrottled("1.2.3.4", db)).toBe(true);
  });

  it("does not throttle when all attempts are outside the 5-minute window", () => {
    insertIpAttempts(db, "1.2.3.4", 30, -6); // 6 minutes ago
    expect(isIpThrottled("1.2.3.4", db)).toBe(false);
  });

  it("does not affect a different IP", () => {
    insertIpAttempts(db, "1.2.3.4", 30);
    expect(isIpThrottled("9.9.9.9", db)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recordLoginAttempt
// ---------------------------------------------------------------------------

describe("recordLoginAttempt", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("inserts one account record and one ip record", () => {
    recordLoginAttempt("alice", "1.2.3.4", db);
    const rows = db
      .prepare("SELECT identifier, type FROM login_attempts ORDER BY id")
      .all() as { identifier: string; type: string }[];
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ identifier: "alice", type: "account" });
    expect(rows).toContainEqual({ identifier: "1.2.3.4", type: "ip" });
  });
});

// ---------------------------------------------------------------------------
// recordIpAttempt
// ---------------------------------------------------------------------------

describe("recordIpAttempt", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("inserts only an ip-type record", () => {
    recordIpAttempt("5.6.7.8", db);
    const rows = db
      .prepare("SELECT identifier, type FROM login_attempts")
      .all() as { identifier: string; type: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ identifier: "5.6.7.8", type: "ip" });
  });
});

// ---------------------------------------------------------------------------
// resetLoginAttempts
// ---------------------------------------------------------------------------

describe("resetLoginAttempts", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("successful login resets the per-account counter", () => {
    insertAccountAttempts(db, "alice", 10);
    expect(isAccountLocked("alice", db)).toBe(true);

    resetLoginAttempts("alice", db);

    expect(isAccountLocked("alice", db)).toBe(false);
  });

  it("does not remove IP-type records", () => {
    // Record both account and IP attempts for alice from one IP.
    for (let i = 0; i < 10; i++) {
      recordLoginAttempt("alice", "1.2.3.4", db);
    }
    expect(isIpThrottled("1.2.3.4", db)).toBe(false); // only 10, below 30
    insertIpAttempts(db, "1.2.3.4", 20); // bring total IP to 30

    resetLoginAttempts("alice", db);

    // Account lock is gone…
    expect(isAccountLocked("alice", db)).toBe(false);
    // …but IP throttle is still in effect.
    expect(isIpThrottled("1.2.3.4", db)).toBe(true);
  });

  it("does not reset attempts for a different account", () => {
    insertAccountAttempts(db, "alice", 10);
    insertAccountAttempts(db, "bob", 10);

    resetLoginAttempts("alice", db);

    expect(isAccountLocked("alice", db)).toBe(false);
    expect(isAccountLocked("bob", db)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cleanupOldLoginAttempts
// ---------------------------------------------------------------------------

describe("cleanupOldLoginAttempts", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("removes attempts older than 1 hour", () => {
    insertAccountAttempts(db, "alice", 5, -61); // 61 minutes ago
    insertIpAttempts(db, "1.2.3.4", 5, -61);

    cleanupOldLoginAttempts(db);

    const count = (
      db.prepare("SELECT COUNT(*) as cnt FROM login_attempts").get() as {
        cnt: number;
      }
    ).cnt;
    expect(count).toBe(0);
  });

  it("cleanup works: keeps recent attempts intact", () => {
    recordLoginAttempt("alice", "1.2.3.4", db); // now → kept
    insertAccountAttempts(db, "alice", 3, -61); // old → removed
    insertIpAttempts(db, "1.2.3.4", 3, -61); // old → removed

    cleanupOldLoginAttempts(db);

    const count = (
      db.prepare("SELECT COUNT(*) as cnt FROM login_attempts").get() as {
        cnt: number;
      }
    ).cnt;
    // Only the 2 recent records (1 account + 1 ip) should remain.
    expect(count).toBe(2);
  });

  it("does not remove attempts younger than 1 hour", () => {
    insertAccountAttempts(db, "alice", 10, -59); // 59 minutes ago → kept
    cleanupOldLoginAttempts(db);

    const count = (
      db.prepare("SELECT COUNT(*) as cnt FROM login_attempts").get() as {
        cnt: number;
      }
    ).cnt;
    expect(count).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// checkAndRecordAttempt
// ---------------------------------------------------------------------------

describe("checkAndRecordAttempt", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
  });

  it("records both account and ip rows when below the threshold", () => {
    insertAccountAttempts(db, "alice", 9);

    const recorded = checkAndRecordAttempt("alice", "1.2.3.4", db);

    expect(recorded).toBe(true);
    const rows = db
      .prepare("SELECT identifier, type FROM login_attempts")
      .all() as { identifier: string; type: string }[];
    expect(rows).toContainEqual({ identifier: "alice", type: "account" });
    expect(rows).toContainEqual({ identifier: "1.2.3.4", type: "ip" });
  });

  it("does not insert when the account is already at the threshold (simulated TOCTOU)", () => {
    // Simulate: account is exactly at the limit as the exclusive check runs.
    insertAccountAttempts(db, "alice", 10);

    const recorded = checkAndRecordAttempt("alice", "1.2.3.4", db);

    expect(recorded).toBe(false);
    // The count must not exceed 10.
    const accountCount = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM login_attempts
           WHERE identifier = 'alice' AND type = 'account'`
        )
        .get() as { cnt: number }
    ).cnt;
    expect(accountCount).toBe(10);
  });

  it("caps recorded attempts at exactly ACCOUNT_MAX_ATTEMPTS under concurrent-style calls", () => {
    // Pre-load 9 attempts, then call checkAndRecordAttempt twice in sequence
    // (simulating two concurrent requests that both passed the early check).
    insertAccountAttempts(db, "alice", 9);

    const first = checkAndRecordAttempt("alice", "1.2.3.4", db);
    const second = checkAndRecordAttempt("alice", "1.2.3.4", db);

    // First call should insert (9 → 10), second should not (already at 10).
    expect(first).toBe(true);
    expect(second).toBe(false);

    const accountCount = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM login_attempts
           WHERE identifier = 'alice' AND type = 'account'`
        )
        .get() as { cnt: number }
    ).cnt;
    // Exactly 10 (9 pre-loaded + 1 from the first call), not 11.
    expect(accountCount).toBe(10);
  });
});
