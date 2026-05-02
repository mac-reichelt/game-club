import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import {
  verifyPassword,
  hashPassword,
  needsRehash,
  createSession,
  isAccountLocked,
  isIpThrottled,
  recordLoginAttempt,
  recordIpAttempt,
  resetLoginAttempts,
  cleanupOldLoginAttempts,
  DUMMY_SCRYPT_HASH,
  getClientIp,
} from "@/lib/auth";
import { Member } from "@/lib/types";

const INVALID_CREDENTIALS = "Invalid credentials";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, password } = body as { name?: string; password?: string };

  if (!name || !password) {
    return NextResponse.json(
      { error: "Name and password are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const ip = getClientIp(request);

  // Periodic housekeeping
  if (Math.random() < 0.05) {
    cleanupOldLoginAttempts(db);
  }

  // --- Per-IP throttle ---
  if (isIpThrottled(ip, db)) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  // --- Per-account lockout ---
  if (isAccountLocked(name, db)) {
    recordIpAttempt(ip, db);
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  const member = db
    .prepare("SELECT * FROM members WHERE name = ? AND disabled = 0")
    .get(name) as (Member & { password_hash: string }) | undefined;

  // Always run verifyPassword (with a dummy scrypt hash for missing accounts)
  // to normalize response timing and prevent user enumeration.
  const storedHash = member?.password_hash || DUMMY_SCRYPT_HASH;
  const passwordValid = await verifyPassword(password, storedHash);

  if (!member || !member.password_hash || !passwordValid) {
    recordLoginAttempt(name, ip, db);
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  // Transparently upgrade legacy SHA-256 hashes to scrypt
  if (needsRehash(member.password_hash)) {
    const newHash = await hashPassword(password);
    db.prepare("UPDATE members SET password_hash = ? WHERE id = ?").run(
      newHash,
      member.id
    );
  }

  // Successful login — reset the per-account failed-attempt counter.
  resetLoginAttempts(name, db);

  const token = createSession(member.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
