import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

// GET /api/members - list all members
export async function GET(request: NextRequest) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "members.view"))
    return NextResponse.json(
      { error: "You don't have permission to do that" },
      { status: 403 }
    );

  const db = getDb();
  const members = db
    .prepare("SELECT id, name, avatar, joined_at FROM members WHERE disabled = 0 AND active = 1 ORDER BY name")
    .all();

  return NextResponse.json(members);
}
