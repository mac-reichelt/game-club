import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { closeElection } from "@/lib/elections";

// POST /api/elections/[id]/close - close an election and tally results (admins only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromToken(
    request.cookies.get("session_token")?.value
  );
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.is_admin)
    return NextResponse.json(
      { error: "Only club admins can close elections" },
      { status: 403 }
    );

  const { id } = await params;
  const electionId = Number(id);
  if (!Number.isSafeInteger(electionId) || electionId < 1) {
    return NextResponse.json({ error: "Invalid election id" }, { status: 400 });
  }

  try {
    // Re-checks the election is open and tallies inside one transaction.
    const result = closeElection(getDb(), electionId);
    if (!result) {
      return NextResponse.json(
        { error: "Election not found or already closed" },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to close election", err);
    return NextResponse.json(
      { error: "Failed to close election" },
      { status: 500 }
    );
  }
}
