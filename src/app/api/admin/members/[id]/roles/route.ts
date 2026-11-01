import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { authorize } from "@/lib/auth";
import { RbacError, setMemberRoles } from "@/lib/permissions";

function fail(err: unknown) {
  if (err instanceof RbacError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("Role management failed", err);
  return NextResponse.json({ error: "Role update failed" }, { status: 500 });
}

async function body(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// PUT /api/admin/members/[id]/roles - replace a member's assigned roles. Body: { roleIds: number[] }
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = authorize(request, "roles.manage");
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const memberId = Number((await ctx.params).id);
  if (!Number.isInteger(memberId) || memberId <= 0)
    return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
  const b = await body(request);
  if (!b) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  try {
    setMemberRoles(getDb(), auth.user.id, memberId, b.roleIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}
