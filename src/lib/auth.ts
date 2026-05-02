import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto, { BinaryLike, ScryptOptions } from "crypto";
import { promisify } from "util";
import Database from "better-sqlite3";
import getDb from "./db";
import { Member } from "./types";

// ---------------------------------------------------------------------------
// Password helpers (scrypt with legacy SHA-256 fallback)
// ---------------------------------------------------------------------------

// scrypt parameters — deliberately work-intensive to resist GPU cracking
const SCRYPT_PREFIX = "scrypt";
const SCRYPT_N = 16384; // CPU/memory cost (2^14)
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelisation factor
const SCRYPT_KEYLEN = 64; // output length in bytes (512 bits)

const scrypt = promisify<BinaryLike, BinaryLike, number, ScryptOptions, Buffer>(
  crypto.scrypt
);

/**
 * Hash a password with scrypt (async — does not block the event loop).
 * Output format: "scrypt:<hex-salt>:<hex-hash>"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${SCRYPT_PREFIX}:${salt}:${hash.toString("hex")}`;
}

/**
 * Returns true when the stored hash was produced by the legacy SHA-256
 * scheme and should be upgraded to scrypt on the next successful login.
 */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`${SCRYPT_PREFIX}:`);
}

/**
 * Verify a plaintext password against a stored hash (async).
 *
 * Supports two formats:
 *   - scrypt  (new):    "scrypt:<salt>:<hash>"
 *   - SHA-256 (legacy): "<salt>:<hash>"
 *
 * All comparisons use crypto.timingSafeEqual to prevent timing oracles.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (stored.startsWith(`${SCRYPT_PREFIX}:`)) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    const storedHash = Buffer.from(hashHex, "hex");
    if (storedHash.length !== SCRYPT_KEYLEN) return false;
    const attempt = await scrypt(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    return crypto.timingSafeEqual(storedHash, attempt);
  } else {
    const parts = stored.split(":");
    if (parts.length !== 2) return false;
    const [salt, hashHex] = parts;
    const storedHash = Buffer.from(hashHex, "hex");
    if (storedHash.length !== 32) return false;
    const attempt = crypto
      .createHash("sha256")
      .update(salt + password)
      .digest();
    return crypto.timingSafeEqual(storedHash, attempt);
  }
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

/**
 * A dummy password hash in scrypt format (`scrypt:<salt>:<hash>`) used as a
 * timing-safe fallback when a login attempt references a non-existent account.
 *
 * Passing this to `verifyPassword` should exercise the same code-path (and
 * take roughly the same wall-clock time) as verifying against a real stored
 * hash — preventing an attacker from enumerating valid usernames via response
 * timing.
 */
export const DUMMY_SCRYPT_HASH = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

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

export function isAccountLocked(
  name: string,
  ip: string,
  db?: Database.Database
): boolean {
  const database = db ?? getDb();
  // Lock by (username, ip) tuple to prevent an attacker from locking out a
  // target account by intentionally failing logins from their own IP.
  const identifier = `${name}\x00${ip}`;
  const row = database
    .prepare(
      `SELECT COUNT(*) as cnt FROM login_attempts
       WHERE identifier = ? AND type = 'account'
       AND attempted_at > datetime('now', ?)`
    )
    .get(identifier, `-${ACCOUNT_WINDOW_MINUTES} minutes`) as { cnt: number };
  return row.cnt >= ACCOUNT_MAX_ATTEMPTS;
}

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

export function recordLoginAttempt(
  name: string,
  ip: string,
  db?: Database.Database
): void {
  const database = db ?? getDb();
  // Account-type identifier is the (name, ip) tuple so that lockouts are
  // scoped to a specific attacker IP and cannot be used to DoS other users.
  const accountIdentifier = `${name}\x00${ip}`;
  const stmt = database.prepare(
    "INSERT INTO login_attempts (identifier, type) VALUES (?, ?)"
  );
  database.transaction(() => {
    stmt.run(accountIdentifier, "account");
    stmt.run(ip, "ip");
  })();
}

export function recordIpAttempt(ip: string, db?: Database.Database): void {
  const database = db ?? getDb();
  database
    .prepare(
      "INSERT INTO login_attempts (identifier, type) VALUES (?, 'ip')"
    )
    .run(ip);
}

export function resetLoginAttempts(
  name: string,
  ip: string,
  db?: Database.Database
): void {
  const database = db ?? getDb();
  const identifier = `${name}\x00${ip}`;
  database
    .prepare(
      "DELETE FROM login_attempts WHERE identifier = ? AND type = 'account'"
    )
    .run(identifier);
}

export function cleanupOldLoginAttempts(db?: Database.Database): void {
  const database = db ?? getDb();
  database
    .prepare(
      `DELETE FROM login_attempts WHERE attempted_at < datetime('now', ?)`
    )
    .run(`-${CLEANUP_AGE_MINUTES} minutes`);
}
