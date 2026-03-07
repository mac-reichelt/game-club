import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { Member } from "@/lib/types";

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
  const member = db
    .prepare("SELECT * FROM members WHERE name = ? AND disabled = 0")
    .get(name) as (Member & { password_hash: string }) | undefined;

  if (!member || !member.password_hash) {
    return NextResponse.json(
      { error: "Invalid name or password" },
      { status: 401 }
    );
  }

  if (!verifyPassword(password, member.password_hash)) {
    return NextResponse.json(
      { error: "Invalid name or password" },
      { status: 401 }
    );
  }

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
