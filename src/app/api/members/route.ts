import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

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
