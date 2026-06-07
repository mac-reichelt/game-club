"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isBannedPassword } from "@/lib/bannedPasswords";

const AVATARS = [
  "🎮", "🕹️", "👾", "🎯", "🏆", "⚔️",
  "🛡️", "🧙", "🐉", "🚀", "🌟", "🎲",
];

interface ProfileFormProps {
  user: { id: number; name: string; avatar: string };
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();

  // Profile fields
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  // Logout
  const [loggingOut, setLoggingOut] = useState(false);

  // Delete account
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileSaving(true);

    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), avatar }),
    });

    if (res.ok) {
      setProfileMsg("Profile updated!");
      router.refresh();
    } else {
      const data = await res.json();
      setProfileMsg(data.error || "Failed to update");
    }
    setProfileSaving(false);
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");

    if (newPassword !== confirmPassword) {
      setPasswordMsg("New passwords do not match");
      return;
    }
    if (newPassword.length < 12) {
      setPasswordMsg("New password must be at least 12 characters");
      return;
    }
    if (isBannedPassword(newPassword)) {
      setPasswordMsg("Password is too common. Please choose a more unique password.");
      return;
    }

    setPasswordSaving(true);

    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setPasswordMsg("Password changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json();
      setPasswordMsg(data.error || "Failed to change password");
    }
    setPasswordSaving(false);
  }

  const profileChanged = name.trim() !== user.name || avatar !== user.avatar;
  const isError = (msg: string) =>
    msg && !msg.includes("updated") && !msg.includes("changed");

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteMsg("");

    if (deleteConfirm !== "DELETE") {
      setDeleteMsg('Type "DELETE" to confirm account deletion');
      return;
    }

    setDeleting(true);
    const res = await fetch("/api/auth/profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: deletePassword }),
    });

    if (res.ok) {
      router.push("/login");
      router.refresh();
      return;
    }

    const data = await res.json();
    setDeleteMsg(data.error || "Failed to delete account");
    setDeleting(false);
  }

  return (
    <div className="grid gap-6">
      {/* Edit Profile */}
      <form
        onSubmit={handleProfileSave}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Edit Profile</h2>

        <div className="mb-4">
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full sm:max-w-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">
            Avatar
          </label>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`text-2xl p-1.5 rounded-lg transition-colors ${
                  avatar === a
                    ? "bg-[var(--color-primary)]/20 ring-2 ring-[var(--color-primary)]"
                    : "hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={profileSaving || !profileChanged || !name.trim()}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {profileSaving ? "Saving..." : "Save Changes"}
          </button>
          {profileMsg && (
            <span
              className={`text-sm ${
                isError(profileMsg)
                  ? "text-[var(--color-danger)]"
                  : "text-green-400"
              }`}
            >
              {profileMsg}
            </span>
          )}
        </div>
      </form>

      {/* Change Password */}
      <form
        onSubmit={handlePasswordSave}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>

        <div className="grid gap-4 sm:max-w-xs mb-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={passwordSaving || !currentPassword || !newPassword}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {passwordSaving ? "Changing..." : "Change Password"}
          </button>
          {passwordMsg && (
            <span
              className={`text-sm ${
                isError(passwordMsg)
                  ? "text-[var(--color-danger)]"
                  : "text-green-400"
              }`}
            >
              {passwordMsg}
            </span>
          )}
        </div>
      </form>

      {/* Delete Account */}
      <form
        onSubmit={handleDeleteAccount}
        className="bg-[var(--color-surface)] border border-[var(--color-danger)]/40 rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold mb-2 text-[var(--color-danger)]">Delete Account</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          This will deactivate your account and anonymize your name to preserve club history.
          This action cannot be undone.
        </p>

        <div className="grid gap-4 sm:max-w-xs mb-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-danger)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              required
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-danger)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={deleting || !deletePassword || !deleteConfirm}
            className="px-4 py-2 bg-[var(--color-danger)] hover:opacity-90 text-white text-sm rounded-lg font-medium transition-opacity disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
          {deleteMsg && (
            <span className="text-sm text-[var(--color-danger)]">{deleteMsg}</span>
          )}
        </div>
      </form>

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors"
      >
        {loggingOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
