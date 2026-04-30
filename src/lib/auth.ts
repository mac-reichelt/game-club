import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import Database from "better-sqlite3";
import getDb from "./db";
import { Member } from "./types";

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const attempt = crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return hash === attempt;
}

export function createSession(memberId: number): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    "INSERT INTO sessions (token, member_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, memberId, expiresAt);
  return token;
}

export function deleteSession(token: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function getMemberByToken(token: string): Member | null {
  const db = getDb();
  const session = db
    .prepare(
      "SELECT member_id FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    )
    .get(token) as { member_id: number } | undefined;
  if (!session) return null;
  return db
    .prepare("SELECT id, name, avatar, joined_at FROM members WHERE id = ?")
    .get(session.member_id) as Member | null;
}

export function getUserFromToken(token: string | undefined): Member | null {
  if (!token) return null;
  return getMemberByToken(token);
}

export async function getCurrentUser(): Promise<Member | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  return token ? getMemberByToken(token) : null;
}

export async function requireAuth(): Promise<Member> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// ---------------------------------------------------------------------------
// Login rate-limiting & lockout
// ---------------------------------------------------------------------------

/** Max failed login attempts per account within the account window. */
const ACCOUNT_MAX_ATTEMPTS = 10;
/** Rolling window (minutes) for per-account attempt counting. */
const ACCOUNT_WINDOW_MINUTES = 10;

/** Max login attempts (all outcomes) from a single IP within the IP window. */
const IP_MAX_ATTEMPTS = 30;
/** Rolling window (minutes) for per-IP attempt counting. */
const IP_WINDOW_MINUTES = 5;

/** Minimum age (minutes) for login_attempts records to be eligible for cleanup. */
const CLEANUP_AGE_MINUTES = 60;

/**
 * Returns true when the account has reached the failed-attempt threshold within
 * the rolling window (i.e. the next login attempt for this account should be
 * rejected).
 */
export function isAccountLocked(
  name: string,
  db?: Database.Database
): boolean {
  const database = db ?? getDb();
  const row = database
    .prepare(
      `SELECT COUNT(*) as cnt FROM login_attempts
       WHERE identifier = ? AND type = 'account'
       AND attempted_at > datetime('now', ?)`
    )
    .get(name, `-${ACCOUNT_WINDOW_MINUTES} minutes`) as { cnt: number };
  return row.cnt >= ACCOUNT_MAX_ATTEMPTS;
}

/**
 * Returns true when the IP address has reached the throttle threshold within
 * the rolling window.
 */
export function isIpThrottled(ip: string, db?: Database.Database): boolean {
  const database = db ?? getDb();
  const row = database
    .prepare(
      `SELECT COUNT(*) as cnt FROM login_attempts
       WHERE identifier = ? AND type = 'ip'
       AND attempted_at > datetime('now', ?)`
    )
    .get(ip, `-${IP_WINDOW_MINUTES} minutes`) as { cnt: number };
  return row.cnt >= IP_MAX_ATTEMPTS;
}

/**
 * Records a failed login attempt for both the account name and the originating
 * IP address.  Both rows are inserted in a single transaction so that either
 * both succeed or neither does.
 */
export function recordLoginAttempt(
  name: string,
  ip: string,
  db?: Database.Database
): void {
  const database = db ?? getDb();
  const stmt = database.prepare(
    "INSERT INTO login_attempts (identifier, type) VALUES (?, ?)"
  );
  database.transaction(() => {
    stmt.run(name, "account");
    stmt.run(ip, "ip");
  })();
}

/**
 * Records a login attempt for an IP address only (used when the account is
 * already locked so we do not inflate the account counter further, but we
 * still want to track the IP).
 */
export function recordIpAttempt(ip: string, db?: Database.Database): void {
  const database = db ?? getDb();
  database
    .prepare(
      "INSERT INTO login_attempts (identifier, type) VALUES (?, 'ip')"
    )
    .run(ip);
}

/**
 * Removes all account-level attempt records for the given name (called on
 * successful login to reset the per-account counter).
 */
export function resetLoginAttempts(
  name: string,
  db?: Database.Database
): void {
  const database = db ?? getDb();
  database
    .prepare(
      "DELETE FROM login_attempts WHERE identifier = ? AND type = 'account'"
    )
    .run(name);
}

/**
 * Deletes login_attempts records older than CLEANUP_AGE_MINUTES.  Call this
 * periodically (e.g. on each login request) to keep the table tidy.
 */
export function cleanupOldLoginAttempts(db?: Database.Database): void {
  const database = db ?? getDb();
  database
    .prepare(
      `DELETE FROM login_attempts WHERE attempted_at < datetime('now', ?)`
    )
    .run(`-${CLEANUP_AGE_MINUTES} minutes`);
}

