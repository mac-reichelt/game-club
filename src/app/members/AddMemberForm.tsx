"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AVATARS = ["🎮", "🕹️", "👾", "🎯", "🏆", "⚔️", "🛡️", "🧙", "🐉", "🚀", "🌟", "🎲"];

export default function AddMemberForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("🎮");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        avatar: selectedAvatar,
      }),
    });

    if (res.ok) {
      form.reset();
      setSelectedAvatar("🎮");
      setIsOpen(false);
      router.refresh();
    }
    setSubmitting(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        + Add Member
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl p-5"
    >
      <h3 className="font-semibold mb-4">Add New Member</h3>
      <div className="mb-4">
        <label className="block text-sm text-[var(--color-text-muted)] mb-1">
          Name *
        </label>
        <input
          name="name"
          required
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
          placeholder="Enter member name"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-[var(--color-text-muted)] mb-2">
          Avatar
        </label>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setSelectedAvatar(emoji)}
              className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                selectedAvatar === emoji
                  ? "bg-[var(--color-primary)] scale-110"
                  : "bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add Member"}
        </button>
      </div>
    </form>
  );
}
