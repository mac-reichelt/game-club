import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import {
  getUserFromToken,
  hashPassword,
  verifyPassword,
  invalidateAllSessions,
  createSession,
} from "@/lib/auth";
import { isBannedPassword } from "@/lib/bannedPasswords";

// PATCH /api/auth/profile - update current user's profile
export async function PATCH(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { name, avatar, currentPassword, newPassword } = body as {
    name?: string;
    avatar?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  // Validate name change
  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }
    const existing = db
      .prepare("SELECT id FROM members WHERE name = ? AND id != ?")
      .get(name.trim(), user.id);
    if (existing) {
      return NextResponse.json(
        { error: "That name is already taken" },
        { status: 409 }
      );
    }
  }

  // Validate password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to change password" },
        { status: 400 }
      );
    }
    if (newPassword.length < 12) {
      return NextResponse.json(
        { error: "New password must be at least 12 characters" },
        { status: 400 }
      );
    }

    if (isBannedPassword(newPassword)) {
      return NextResponse.json(
        { error: "Password is too common. Please choose a more unique password." },
        { status: 400 }
      );
    }

    const member = db
      .prepare("SELECT password_hash FROM members WHERE id = ?")
      .get(user.id) as { password_hash: string } | undefined;

    if (!member || !await verifyPassword(currentPassword, member.password_hash)) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }
  }

  // Apply updates
  if (name !== undefined) {
    db.prepare("UPDATE members SET name = ? WHERE id = ?").run(
      name.trim(),
      user.id
    );
  }
  if (avatar !== undefined) {
    db.prepare("UPDATE members SET avatar = ? WHERE id = ?").run(
      avatar,
      user.id
    );
  }

  let newSessionToken: string | null = null;
  if (newPassword) {
    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE members SET password_hash = ?, password_changed_at = ? WHERE id = ?"
    ).run(newHash, now, user.id);
    // Invalidate all existing sessions (including the current one) and issue a
    // fresh session so the current device stays logged in while all other
    // sessions (potentially held by an attacker) become invalid.
    invalidateAllSessions(user.id);
    newSessionToken = createSession(user.id);
  }

  // Return updated user
  const updated = db
    .prepare("SELECT id, name, avatar, joined_at FROM members WHERE id = ?")
    .get(user.id);

  const response = NextResponse.json(updated);
  if (newSessionToken) {
    response.cookies.set("session_token", newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}
