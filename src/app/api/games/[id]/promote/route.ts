import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const gameId = parseInt(id);

  // Set any current game to completed
  db.prepare(
    "UPDATE games SET status = 'completed', completed_date = datetime('now') WHERE status = 'current'"
  ).run();

  // Promote this game to current
  db.prepare(
    "UPDATE games SET status = 'current', scheduled_date = datetime('now') WHERE id = ?"
  ).run(gameId);

  // Redirect back to nominations
  return NextResponse.redirect(new URL("/nominations", _request.url));
}
