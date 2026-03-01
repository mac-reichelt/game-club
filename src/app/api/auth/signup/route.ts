import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, password, avatar } = body as {
    name?: string;
    password?: string;
    avatar?: string;
  };

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  if (!password || password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 }
    );
  }

  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM members WHERE name = ?")
    .get(name.trim());
  if (existing) {
    return NextResponse.json(
      { error: "That name is already taken" },
      { status: 409 }
    );
  }

  const passwordHash = hashPassword(password);
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
