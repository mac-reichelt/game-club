"use client";

import { useEffect, useState } from "react";

interface Role {
  id: number;
  name: string;
  is_default: number;
  is_system: number;
  permissions: string[];
}
interface MemberRow {
  id: number;
  name: string;
  avatar: string;
  roleIds: number[];
}
interface Data {
  permissions: { key: string; label: string }[];
  roles: Role[];
  members: MemberRow[];
}

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? `Request failed (${res.status})`;
}

export default function RolesManager() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/roles")
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) setError("Couldn't load roles");
        else setData(await res.json());
      })
      .catch(() => alive && setError("Couldn't load roles"));
    return () => {
      alive = false;
    };
  }, [version]);

  async function run(p: Promise<string | null>) {
    const err = await p;
    setError(err);
    setVersion((v) => v + 1);
  }

  if (!data) return <p>{error ?? "Loading…"}</p>;

  const togglePerm = (role: Role, perm: string) => {
    const next = role.permissions.includes(perm)
      ? role.permissions.filter((p) => p !== perm)
      : [...role.permissions, perm];
    void run(send(`/api/admin/roles/${role.id}`, "PATCH", { permissions: next }));
  };

  const toggleMemberRole = (m: MemberRow, roleId: number) => {
    const next = m.roleIds.includes(roleId) ? m.roleIds.filter((r) => r !== roleId) : [...m.roleIds, roleId];
    void run(send(`/api/admin/members/${m.id}/roles`, "PUT", { roleIds: next }));
  };

  const assignable = data.roles.filter((r) => !r.is_default);

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-red-400" role="alert">{error}</p>}

      <section>
        <h2 className="text-xl font-semibold mb-3">Roles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2">Permission</th>
                {data.roles.map((r) => (
                  <th key={r.id} className="p-2 text-center">
                    {r.name}
                    {r.is_default ? <div className="text-xs font-normal">everyone</div> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr key={p.key} className="border-t border-[var(--color-border)]">
                  <td className="p-2">{p.label}</td>
                  {data.roles.map((r) => (
                    <td key={r.id} className="p-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${r.name}: ${p.label}`}
                        checked={r.permissions.includes(p.key)}
                        disabled={!!r.is_system}
                        onChange={() => togglePerm(r, p.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-[var(--color-border)]">
                <td className="p-2">Applies to everyone</td>
                {data.roles.map((r) => (
                  <td key={r.id} className="p-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${r.name}: applies to everyone`}
                      checked={!!r.is_default}
                      disabled={!!r.is_system}
                      onChange={() => void run(send(`/api/admin/roles/${r.id}`, "PATCH", { isDefault: !r.is_default }))}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td />
                {data.roles.map((r) => (
                  <td key={r.id} className="p-2 text-center">
                    {!r.is_system && (
                      <button
                        className="text-xs underline"
                        onClick={() => {
                          if (confirm(`Delete role ${r.name}?`)) void run(send(`/api/admin/roles/${r.id}`, "DELETE"));
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <form
          className="flex gap-2 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            void run(send("/api/admin/roles", "POST", { name: newName.trim(), permissions: [] }));
            setNewName("");
          }}
        >
          <input
            className="px-3 py-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)]"
            placeholder="New role name"
            value={newName}
            maxLength={40}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="px-4 py-2 rounded bg-[var(--color-primary)] text-white">
            Add role
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Members</h2>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Member</th>
              {assignable.map((r) => (
                <th key={r.id} className="p-2 text-center">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.id} className="border-t border-[var(--color-border)]">
                <td className="p-2">
                  {m.avatar} {m.name}
                </td>
                {assignable.map((r) => (
                  <td key={r.id} className="p-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${m.name}: ${r.name}`}
                      checked={m.roleIds.includes(r.id)}
                      onChange={() => toggleMemberRole(m, r.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
