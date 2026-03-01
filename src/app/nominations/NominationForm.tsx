"use client";

import { Member } from "@/lib/types";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NominationForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        platform: formData.get("platform"),
        description: formData.get("description"),
        nominatedBy: Number(formData.get("nominatedBy")),
      }),
    });

    if (res.ok) {
      form.reset();
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
        + Nominate a Game
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl p-5"
    >
      <h3 className="font-semibold mb-4">Nominate a Game</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">
            Game Title *
          </label>
          <input
            name="title"
            required
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            placeholder="e.g. Hades"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">
            Platform
          </label>
          <input
            name="platform"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            placeholder="e.g. PC, PS5, Switch"
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm text-[var(--color-text-muted)] mb-1">
          Description
        </label>
        <textarea
          name="description"
          rows={2}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
          placeholder="Why should we play this?"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-[var(--color-text-muted)] mb-1">
          Nominated By *
        </label>
        <select
          name="nominatedBy"
          required
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
        >
          <option value="">Select a member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.avatar} {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? "Nominating..." : "Nominate"}
        </button>
      </div>
    </form>
  );
}
