import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  RbacError,
  can,
  createRole,
  deleteRole,
  ensureRbac,
  getMemberPermissions,
  isOwner,
  listRoles,
  setMemberRoles,
  updateRole,
} from "@/lib/permissions";

let db: Database.Database;

function fresh(admins: number[] = [2]) {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(`CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL DEFAULT '', disabled INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
    is_admin INTEGER NOT NULL DEFAULT 0)`);
  for (const n of ["a", "b", "c", "d"]) d.prepare("INSERT INTO members (name) VALUES (?)").run(n);
  for (const id of admins) d.prepare("UPDATE members SET is_admin = 1 WHERE id = ?").run(id);
  ensureRbac(d);
  return d;
}

const roleId = (name: string) => listRoles(db).find((r) => r.name === name)!.id;
const expectRbac = (fn: () => unknown, status: number) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RbacError);
    expect((e as RbacError).status).toBe(status);
    return;
  }
  throw new Error("expected RbacError");
};

describe("roles and permissions", () => {
  beforeEach(() => {
    db = fresh();
  });

  it("migrates the old admin flag: first admin is Owner, admins get Admin, everyone gets Member", () => {
    expect(isOwner(db, 2)).toBe(true);
    expect(getMemberPermissions(db, 2)).toContain("roles.manage");
    expect(getMemberPermissions(db, 1)).toEqual(
      expect.arrayContaining(["games.nominate", "elections.vote", "games.review"])
    );
    expect(getMemberPermissions(db, 1)).not.toContain("elections.create");
    expect(can({ permissions: getMemberPermissions(db, 2) }, "elections.close")).toBe(true);
  });

  it("is idempotent and falls back to the first member as Owner when nobody was admin", () => {
    ensureRbac(db);
    expect(listRoles(db)).toHaveLength(3);
    const d = fresh([]);
    expect(isOwner(d, 1)).toBe(true);
  });

  it("grants permissions through assigned roles", () => {
    const mod = createRole(db, 2, { name: "Moderator", permissions: ["elections.close"] });
    setMemberRoles(db, 2, 3, [mod.id]);
    expect(getMemberPermissions(db, 3)).toContain("elections.close");
    expect(getMemberPermissions(db, 3)).not.toContain("elections.create");
    setMemberRoles(db, 2, 3, []);
    expect(getMemberPermissions(db, 3)).not.toContain("elections.close");
  });

  it("default roles apply to everyone", () => {
    const r = createRole(db, 2, { name: "Starters", permissions: ["elections.create"], isDefault: true });
    expect(getMemberPermissions(db, 4)).toContain("elections.create");
    updateRole(db, 2, r.id, { isDefault: false });
    expect(getMemberPermissions(db, 4)).not.toContain("elections.create");
  });

  it("stops non-owners granting permissions they lack or touching Owner", () => {
    const mgr = createRole(db, 2, { name: "Role manager", permissions: ["roles.manage"] });
    setMemberRoles(db, 2, 3, [mgr.id]);
    expectRbac(() => createRole(db, 3, { name: "x", permissions: ["elections.create"] }), 403);
    expectRbac(() => setMemberRoles(db, 3, 3, [mgr.id, roleId("Admin")]), 403);
    expectRbac(() => setMemberRoles(db, 3, 3, [mgr.id, roleId("Owner")]), 403);
    expectRbac(() => updateRole(db, 3, mgr.id, { permissions: ["roles.manage", "elections.close"] }), 403);
    // Within their own permissions it works.
    const ok = createRole(db, 3, { name: "Voters", permissions: ["elections.vote"] });
    expect(ok.permissions).toEqual(["elections.vote"]);
  });

  it("protects the Owner role and the last owner", () => {
    const owner = roleId("Owner");
    expectRbac(() => updateRole(db, 2, owner, { permissions: [] }), 400);
    expectRbac(() => deleteRole(db, 2, owner), 400);
    expectRbac(() => setMemberRoles(db, 2, 2, []), 400);
    setMemberRoles(db, 2, 1, [owner]);
    setMemberRoles(db, 2, 2, []);
    expect(isOwner(db, 2)).toBe(false);
  });

  it("validates input", () => {
    expectRbac(() => createRole(db, 2, { name: "", permissions: [] }), 400);
    expectRbac(() => createRole(db, 2, { name: "z", permissions: ["nope"] }), 400);
    expectRbac(() => createRole(db, 2, { name: "admin", permissions: [] }), 409);
    expectRbac(() => setMemberRoles(db, 2, 99, []), 404);
    expectRbac(() => setMemberRoles(db, 2, 3, [999]), 404);
    expectRbac(() => setMemberRoles(db, 2, 3, "1"), 400);
  });

  it("deleting a role removes its grants", () => {
    const r = createRole(db, 2, { name: "Temp", permissions: ["elections.close"] });
    setMemberRoles(db, 2, 4, [r.id]);
    deleteRole(db, 2, r.id);
    expect(getMemberPermissions(db, 4)).not.toContain("elections.close");
  });
});
