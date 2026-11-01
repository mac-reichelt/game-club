import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { authorize } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS, RbacError, createRole, listMembersWithRoles, listRoles } from "@/lib/permissions";

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

// GET /api/admin/roles - roles, permissions catalogue and member assignments (roles.manage)
export async function GET(request: NextRequest) {
  const auth = authorize(request, "roles.manage");
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const db = getDb();
  return NextResponse.json({
    permissions: ALL_PERMISSIONS.map((key) => ({ key, label: PERMISSIONS[key] })),
    roles: listRoles(db),
    members: listMembersWithRoles(db),
  });
}

// POST /api/admin/roles - create a role. Body: { name, permissions: string[], isDefault? }
export async function POST(request: NextRequest) {
  const auth = authorize(request, "roles.manage");
  if (auth.error) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const b = await body(request);
  if (!b) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  try {
    return NextResponse.json(createRole(getDb(), auth.user.id, b as never), { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
