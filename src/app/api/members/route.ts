import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken, hashPassword } from "@/lib/auth";

// GET /api/members - list all members
export async function GET(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const members = db
    .prepare("SELECT id, name, avatar, joined_at FROM members ORDER BY name")
    .all();

  return NextResponse.json(members);
}

// POST /api/members - create a new member
// Body: { name, avatar?, password }
export async function POST(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { name, avatar, password } = body;

  if (!name) {
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

  // Check for duplicate name
  const existing = db
    .prepare("SELECT id FROM members WHERE name = ?")
    .get(name);
  if (existing) {
    return NextResponse.json(
      { error: "A member with that name already exists" },
      { status: 409 }
    );
  }

  const passwordHash = hashPassword(password);

  const result = db
    .prepare(
      "INSERT INTO members (name, avatar, password_hash) VALUES (?, ?, ?)"
    )
    .run(name, avatar || "🎮", passwordHash);

  return NextResponse.json(
    { id: result.lastInsertRowid, name, avatar: avatar || "🎮" },
    { status: 201 }
  );
}
