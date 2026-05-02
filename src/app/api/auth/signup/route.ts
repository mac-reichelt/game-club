import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import getDb from "@/lib/db";
import {
  hashPassword,
  createSession,
  isIpThrottled,
  recordIpAttempt,
  cleanupOldLoginAttempts,
  getClientIp,
} from "@/lib/auth";
import { isBannedPassword } from "@/lib/bannedPasswords";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  // Pad both buffers to equal length so timingSafeEqual can compare them
  // without leaking length information via short-circuit.
  const paddedA = Buffer.concat([bufA, Buffer.alloc(maxLen - bufA.length)]);
  const paddedB = Buffer.concat([bufB, Buffer.alloc(maxLen - bufB.length)]);
  return timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

export async function POST(request: NextRequest) {
  const configuredCode = process.env.SIGNUP_INVITE_CODE ?? "";
  if (!configuredCode) {
    return NextResponse.json(
      { error: "Signup is not available" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, password, avatar, inviteCode } = body as {
    name?: string;
    password?: string;
    avatar?: string;
    inviteCode?: string;
  };

  if (!inviteCode || !safeCompare(inviteCode, configuredCode)) {
    return NextResponse.json(
      { error: "Invalid or missing invite code" },
      { status: 403 }
    );
  }

  const db = getDb();
  const ip = getClientIp(request);

  // Periodic housekeeping
  if (Math.random() < 0.05) {
    cleanupOldLoginAttempts(db);
  }

  // Per-IP throttle — prevents bulk account creation and username enumeration.
  // Reuses the same login_attempts table and thresholds as the login endpoint
  // so that abuse on either endpoint contributes to the shared IP counter.
  if (isIpThrottled(ip, db)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  if (!password || password.length < 12) {
    return NextResponse.json(
      { error: "Password must be at least 12 characters" },
      { status: 400 }
    );
  }

  if (isBannedPassword(password)) {
    return NextResponse.json(
      { error: "Password is too common. Please choose a more unique password." },
      { status: 400 }
    );
  }

  const existing = db
    .prepare("SELECT id FROM members WHERE name = ?")
    .get(name.trim());
  if (existing) {
    recordIpAttempt(ip, db);
    return NextResponse.json(
      { error: "That name is not available" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO members (name, avatar, password_hash) VALUES (?, ?, ?)"
    )
    .run(name.trim(), avatar || "🎮", passwordHash);

  // Auto-login after signup
  const token = createSession(result.lastInsertRowid as number);

  const response = NextResponse.json(
    { success: true, id: result.lastInsertRowid },
    { status: 201 }
  );
  response.cookies.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
