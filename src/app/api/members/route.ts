import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const members = db.prepare("SELECT * FROM members ORDER BY name").all();
  return NextResponse.json(members);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { name, avatar } = body;

  if (!name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  try {
    const result = db
      .prepare("INSERT INTO members (name, avatar) VALUES (?, ?)")
      .run(name, avatar || "🎮");
    return NextResponse.json(
      { id: result.lastInsertRowid },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Member with this name already exists" },
      { status: 409 }
    );
  }
}
