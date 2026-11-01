import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import RolesManager from "./RolesManager";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await requireAuth();
  if (!can(user, "roles.manage")) redirect("/");
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Roles &amp; permissions</h1>
      <p className="text-[var(--color-text-muted)] mb-8">
        Members get the permissions of every role assigned to them, plus any role marked
        &ldquo;everyone&rdquo;. Owner always has every permission.
      </p>
      <RolesManager />
    </div>
  );
}
