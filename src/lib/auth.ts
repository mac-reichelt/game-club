import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import getDb from "./db";
import { Member } from "./types";

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
