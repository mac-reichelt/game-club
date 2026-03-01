import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { memberId } = body;

  if (!memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 }
    );
  }

  try {
    db.prepare(
      "INSERT INTO votes (game_id, member_id) VALUES (?, ?)"
    ).run(parseInt(id), memberId);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    // Unique constraint violation = already voted
    return NextResponse.json(
      { error: "Already voted for this game" },
      { status: 409 }
    );
  }
}
