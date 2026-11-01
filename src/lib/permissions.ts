import type Database from "better-sqlite3";

/**
 * Role-based permissions (game-club: replaces the single is_admin flag).
 *
 * Members get permissions from roles. A role marked `is_default` applies to every
 * member automatically; other roles are assigned per member. The built-in Owner
 * role always holds every permission, can't be edited or deleted, and at least one
 * active member must keep it.
 *
 * Escalation guard: a member can only create, edit or assign roles whose
 * permissions they already hold, and only an Owner can grant or revoke Owner.
 */

export const PERMISSIONS = {
  "games.nominate": "Nominate games",
  "games.refresh": "Refresh game info from GameDB",
  "games.review": "Write reviews",
  "elections.vote": "Vote in elections",
  "elections.create": "Start elections",
  "elections.close": "Close elections",
  "members.view": "See the member list",
  "roles.manage": "Manage roles and member permissions",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const OWNER_ROLE = "Owner";

const MEMBER_DEFAULTS: Permission[] = [
  "games.nominate",
  "games.refresh",
  "games.review",
  "elections.vote",
  "members.view",
];
const ADMIN_DEFAULTS: Permission[] = [...MEMBER_DEFAULTS, "elections.create", "elections.close"];

export function isPermission(p: unknown): p is Permission {
  return typeof p === "string" && Object.prototype.hasOwnProperty.call(PERMISSIONS, p);
}

export function can(user: { permissions?: readonly string[] } | null | undefined, perm: Permission): boolean {
  return !!user?.permissions?.includes(perm);
}

export function ensureRbac(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      PRIMARY KEY (role_id, permission)
    );
    CREATE TABLE IF NOT EXISTS member_roles (
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (member_id, role_id)
    );
  `);

  const seed = db.transaction(() => {
    const existing = (db.prepare("SELECT COUNT(*) c FROM roles").get() as { c: number }).c;
    if (existing > 0) return;
    const addRole = db.prepare("INSERT INTO roles (name, is_default, is_system) VALUES (?, ?, ?)");
    const addPerm = db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)");
    const make = (name: string, isDefault: number, isSystem: number, perms: Permission[]) => {
      const id = Number(addRole.run(name, isDefault, isSystem).lastInsertRowid);
      for (const p of perms) addPerm.run(id, p);
      return id;
    };
    const ownerId = make(OWNER_ROLE, 0, 1, ALL_PERMISSIONS);
    const adminId = make("Admin", 0, 0, ADMIN_DEFAULTS);
    make("Member", 1, 0, MEMBER_DEFAULTS);

    // Carry over the old is_admin flag: the earliest admin becomes Owner, every admin gets Admin.
    const memberCols = db.prepare("PRAGMA table_info(members)").all() as { name: string }[];
    const admins = memberCols.some((c) => c.name === "is_admin")
      ? (db.prepare("SELECT id FROM members WHERE is_admin = 1 ORDER BY id").all() as { id: number }[])
      : [];
    const assign = db.prepare("INSERT OR IGNORE INTO member_roles (member_id, role_id) VALUES (?, ?)");
    for (const a of admins) assign.run(a.id, adminId);
    if (admins.length) assign.run(admins[0].id, ownerId);
  });
  seed();
  ensureOwner(db);
}

/** If no active member holds Owner, the longest-standing active member gets it. */
export function ensureOwner(db: Database.Database) {
  db.exec(`
    INSERT OR IGNORE INTO member_roles (member_id, role_id)
    SELECT (SELECT MIN(id) FROM members WHERE disabled = 0 AND active = 1),
           (SELECT id FROM roles WHERE is_system = 1 AND name = '${OWNER_ROLE}')
    WHERE (SELECT MIN(id) FROM members WHERE disabled = 0 AND active = 1) IS NOT NULL
      AND (SELECT id FROM roles WHERE is_system = 1 AND name = '${OWNER_ROLE}') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM member_roles mr
        JOIN roles r ON r.id = mr.role_id
        JOIN members m ON m.id = mr.member_id
        WHERE r.is_system = 1 AND r.name = '${OWNER_ROLE}' AND m.disabled = 0 AND m.active = 1
      )
  `);
}

export function getMemberPermissions(db: Database.Database, memberId: number): Permission[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT rp.permission FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE r.is_default = 1
          OR r.id IN (SELECT role_id FROM member_roles WHERE member_id = ?)`
    )
    .all(memberId) as { permission: string }[];
  return rows.map((r) => r.permission).filter(isPermission);
}

export function isOwner(db: Database.Database, memberId: number): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM member_roles mr JOIN roles r ON r.id = mr.role_id
       WHERE mr.member_id = ? AND r.is_system = 1 AND r.name = ?`
    )
    .get(memberId, OWNER_ROLE);
}

export class RbacError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface RoleRow {
  id: number;
  name: string;
  is_default: number;
  is_system: number;
  permissions: Permission[];
}

export function listRoles(db: Database.Database): RoleRow[] {
  const roles = db.prepare("SELECT id, name, is_default, is_system FROM roles ORDER BY is_system DESC, id").all() as Omit<
    RoleRow,
    "permissions"
  >[];
  const perms = db.prepare("SELECT role_id, permission FROM role_permissions").all() as {
    role_id: number;
    permission: string;
  }[];
  return roles.map((r) => ({
    ...r,
    permissions: perms.filter((p) => p.role_id === r.id).map((p) => p.permission).filter(isPermission),
  }));
}

function getRole(db: Database.Database, id: number): RoleRow {
  const role = listRoles(db).find((r) => r.id === id);
  if (!role) throw new RbacError("Role not found", 404);
  return role;
}

function checkGrantable(db: Database.Database, actorId: number, perms: readonly Permission[]) {
  if (isOwner(db, actorId)) return;
  const mine = new Set(getMemberPermissions(db, actorId));
  const missing = perms.filter((p) => !mine.has(p));
  if (missing.length) throw new RbacError(`You can't grant permissions you don't have: ${missing.join(", ")}`, 403);
}

export function parsePermissions(raw: unknown): Permission[] {
  if (!Array.isArray(raw)) throw new RbacError("permissions must be an array", 400);
  const bad = raw.filter((p) => !isPermission(p));
  if (bad.length) throw new RbacError("Unknown permission", 400);
  return [...new Set(raw as Permission[])];
}

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw new RbacError("name is required", 400);
  const name = raw.trim();
  if (!name || name.length > 40) throw new RbacError("Role name must be 1-40 characters", 400);
  return name;
}

export function createRole(
  db: Database.Database,
  actorId: number,
  input: { name: unknown; permissions: unknown; isDefault?: unknown }
): RoleRow {
  const name = cleanName(input.name);
  const perms = parsePermissions(input.permissions);
  checkGrantable(db, actorId, perms);
  return db.transaction(() => {
    if (db.prepare("SELECT 1 FROM roles WHERE name = ?").get(name)) throw new RbacError("A role with that name exists", 409);
    const id = Number(
      db.prepare("INSERT INTO roles (name, is_default) VALUES (?, ?)").run(name, input.isDefault === true ? 1 : 0)
        .lastInsertRowid
    );
    const add = db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)");
    for (const p of perms) add.run(id, p);
    return getRole(db, id);
  })();
}

export function updateRole(
  db: Database.Database,
  actorId: number,
  id: number,
  input: { name?: unknown; permissions?: unknown; isDefault?: unknown }
): RoleRow {
  return db.transaction(() => {
    const role = getRole(db, id);
    if (role.is_system) throw new RbacError("The Owner role can't be changed", 400);
    // Editing a role changes what its holders can do, so the actor must hold both old and new permissions.
    checkGrantable(db, actorId, role.permissions);
    if (input.name !== undefined) {
      const name = cleanName(input.name);
      const clash = db.prepare("SELECT id FROM roles WHERE name = ? AND id != ?").get(name, id);
      if (clash) throw new RbacError("A role with that name exists", 409);
      db.prepare("UPDATE roles SET name = ? WHERE id = ?").run(name, id);
    }
    if (input.isDefault !== undefined) {
      db.prepare("UPDATE roles SET is_default = ? WHERE id = ?").run(input.isDefault === true ? 1 : 0, id);
    }
    if (input.permissions !== undefined) {
      const perms = parsePermissions(input.permissions);
      checkGrantable(db, actorId, perms);
      db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(id);
      const add = db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)");
      for (const p of perms) add.run(id, p);
    }
    assertSomeoneCanManage(db);
    return getRole(db, id);
  })();
}

export function deleteRole(db: Database.Database, actorId: number, id: number) {
  db.transaction(() => {
    const role = getRole(db, id);
    if (role.is_system) throw new RbacError("The Owner role can't be deleted", 400);
    checkGrantable(db, actorId, role.permissions);
    db.prepare("DELETE FROM roles WHERE id = ?").run(id);
    assertSomeoneCanManage(db);
  })();
}

export function setMemberRoles(db: Database.Database, actorId: number, memberId: number, rawRoleIds: unknown) {
  if (!Array.isArray(rawRoleIds) || !rawRoleIds.every((r) => Number.isInteger(r) && r > 0)) {
    throw new RbacError("roleIds must be an array of role ids", 400);
  }
  const roleIds = [...new Set(rawRoleIds as number[])];
  db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM members WHERE id = ?").get(memberId)) throw new RbacError("Member not found", 404);
    const roles = listRoles(db);
    const byId = new Map(roles.map((r) => [r.id, r]));
    if (roleIds.some((r) => !byId.has(r))) throw new RbacError("Role not found", 404);
    const current = (
      db.prepare("SELECT role_id FROM member_roles WHERE member_id = ?").all(memberId) as { role_id: number }[]
    ).map((r) => r.role_id);
    const added = roleIds.filter((r) => !current.includes(r));
    const removed = current.filter((r) => !roleIds.includes(r));
    const actorIsOwner = isOwner(db, actorId);
    for (const rid of [...added, ...removed]) {
      const role = byId.get(rid)!;
      if (role.is_system && !actorIsOwner) throw new RbacError("Only an Owner can grant or revoke Owner", 403);
      checkGrantable(db, actorId, role.permissions);
    }
    const del = db.prepare("DELETE FROM member_roles WHERE member_id = ? AND role_id = ?");
    const ins = db.prepare("INSERT OR IGNORE INTO member_roles (member_id, role_id) VALUES (?, ?)");
    for (const r of removed) del.run(memberId, r);
    for (const r of added) ins.run(memberId, r);
    const owners = (
      db
        .prepare(
          `SELECT COUNT(*) c FROM member_roles mr JOIN roles r ON r.id = mr.role_id
           JOIN members m ON m.id = mr.member_id
           WHERE r.is_system = 1 AND m.disabled = 0 AND m.active = 1`
        )
        .get() as { c: number }
    ).c;
    if (owners === 0) throw new RbacError("The club must keep at least one Owner", 400);
  })();
}

function assertSomeoneCanManage(db: Database.Database) {
  // Owner always has roles.manage, and ensureOwner guarantees an Owner exists, so this only
  // guards against a broken Owner role.
  const owner = db.prepare("SELECT id FROM roles WHERE is_system = 1").get();
  if (!owner) throw new RbacError("The Owner role is missing", 500);
}

export function listMembersWithRoles(db: Database.Database) {
  const members = db
    .prepare("SELECT id, name, avatar FROM members WHERE disabled = 0 AND active = 1 ORDER BY name")
    .all() as { id: number; name: string; avatar: string }[];
  const links = db.prepare("SELECT member_id, role_id FROM member_roles").all() as {
    member_id: number;
    role_id: number;
  }[];
  return members.map((m) => ({ ...m, roleIds: links.filter((l) => l.member_id === m.id).map((l) => l.role_id) }));
}
