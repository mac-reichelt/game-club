"use client";

import { GameWithNominator } from "@/lib/types";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartElectionButton({
  games,
}: {
  games: GameWithNominator[];
}) {
  const router = useRouter();
  const [showSelect, setShowSelect] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredGames = games.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      (g.platform?.toLowerCase().includes(q) ?? false) ||
      (g.nominatorName?.toLowerCase().includes(q) ?? false)
    );
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startElection() {
    if (selected.size < 2) {
      alert("Select at least 2 games");
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/elections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameIds: Array.from(selected) }),
    });

    if (res.ok) {
      setShowSelect(false);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to start election");
    }
    setSubmitting(false);
  }

  if (!showSelect) {
    return (
      <button
        onClick={() => setShowSelect(true)}
        className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors"
      >
        🗳️ Start Monthly Vote
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md">
        <h3 className="font-semibold text-lg mb-1">Start Monthly Election</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-1">
          Select which nominated games to include in the vote.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Voting will be open for 72 hours.
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search games..."
          className="w-full mb-3 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
        <div className="grid gap-2 mb-4 max-h-64 overflow-y-auto">
          {filteredGames.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
              No games match your search.
            </p>
          )}
          {filteredGames.map((game) => (
            <label
              key={game.id}
              className="flex items-center gap-3 bg-[var(--color-bg)] rounded-lg px-3 py-2 cursor-pointer hover:bg-[var(--color-surface-hover)]"
            >
              <input
                type="checkbox"
                checked={selected.has(game.id)}
                onChange={() => toggle(game.id)}
                className="accent-[var(--color-primary)]"
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{game.title}</span>
                {game.platform && (
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">
                    ({game.platform})
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setShowSelect(false)}
            className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            onClick={startElection}
            disabled={submitting || selected.size < 2}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? "Starting..." : `Start Vote (${selected.size} games)`}
          </button>
        </div>
      </div>
    </div>
  );
}
