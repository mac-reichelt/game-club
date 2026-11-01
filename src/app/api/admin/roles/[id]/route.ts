import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { authorize } from "@/lib/auth";
import { RbacError, deleteRole, updateRole } from "@/lib/permissions";

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

type Ctx = { params: Promise<{ id: string }> };

async function roleId(ctx: Ctx): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/admin/roles/[id] - Body: { name?, permissions?, isDefault? }
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = authorize(request, "roles.manage");
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const id = await roleId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
  const b = await body(request);
  if (!b) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  try {
    return NextResponse.json(updateRole(getDb(), auth.user.id, id, b));
  } catch (err) {
    return fail(err);
  }
}

// DELETE /api/admin/roles/[id]
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = authorize(request, "roles.manage");
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const id = await roleId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
  try {
    deleteRole(getDb(), auth.user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}
