import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import {
  verifyPassword,
  createSession,
  isAccountLocked,
  isIpThrottled,
  recordLoginAttempt,
  recordIpAttempt,
  resetLoginAttempts,
  cleanupOldLoginAttempts,
} from "@/lib/auth";
import { Member } from "@/lib/types";

/**
 * Extract the real client IP, preferring the first entry in X-Forwarded-For.
 *
 * IMPORTANT: This header can be spoofed by clients that connect directly.
 * The application must be deployed behind a trusted reverse-proxy (e.g.
 * Traefik, Nginx, or a cloud load-balancer) that sets X-Forwarded-For before
 * requests reach Next.js.  Without a trusted proxy, an attacker can bypass
 * per-IP throttling by injecting an arbitrary header value.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

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

  // Periodic housekeeping: run on ~5% of requests to keep the table small
  // without creating noticeable overhead on every login call.
  if (Math.random() < 0.05) {
    cleanupOldLoginAttempts(db);
  }

  // --- Per-IP throttle ---
  // Count all login attempts from this IP within the rolling window.
  // If the threshold is reached, reject immediately without recording another
  // attempt (the records are already counted).
  if (isIpThrottled(ip, db)) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  // --- Per-account lockout ---
  // If the account has too many recent failed attempts, record only the IP
  // contribution (so IP throttle still fires) and reject with a generic error
  // to avoid leaking lockout state to the caller.
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

  // Always call verifyPassword to normalize response timing across the
  // 'account not found' and 'wrong password' paths, preventing user
  // enumeration via timing differences.
  const storedHash = member?.password_hash || `:${"0".repeat(64)}`;
  const passwordValid = verifyPassword(password, storedHash);

  if (!member || !member.password_hash || !passwordValid) {
    // Record the failed attempt for both account and IP before responding.
    recordLoginAttempt(name, ip, db);
    return NextResponse.json(
      { error: INVALID_CREDENTIALS },
      { status: 401 }
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}

