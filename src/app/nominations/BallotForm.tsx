"use client";

import { GameWithNominator } from "@/lib/types";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function BallotForm({
  electionId,
  games,
  hasVoted,
}: {
  electionId: number;
  games: GameWithNominator[];
  hasVoted: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [rankings, setRankings] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const availableGames = games.filter((g) => !rankings.includes(g.id));

  const addToRanking = useCallback((gameId: number) => {
    setRankings((prev) => [...prev, gameId]);
  }, []);

  const removeFromRanking = useCallback((index: number) => {
    setRankings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setRankings((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setRankings((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setOverIndex(null);
      return;
    }

    setRankings((prev) => {
      const next = [...prev];
      const [removed] = next.splice(draggedIndex, 1);
      next.splice(index, 0, removed);
      return next;
    });

    setDraggedIndex(null);
    setOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setOverIndex(null);
  }

  async function handleSubmit() {
    if (rankings.length === 0) return;
    setSubmitting(true);

    const res = await fetch(`/api/elections/${electionId}/ballot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rankings }),
    });

    if (res.ok) {
      setRankings([]);
      setIsOpen(false);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to submit ballot");
    }
    setSubmitting(false);
  }

  if (hasVoted) {
    return (
      <div className="text-sm text-[var(--color-accent)] text-center py-2 flex items-center justify-center gap-2">
        <span>✓</span> You&apos;ve already voted in this election.
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full border border-dashed border-[var(--color-border)] rounded-lg p-3 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        🗳️ Cast Your Ballot
      </button>
    );
  }

  return (
    <div className="bg-[var(--color-bg)] rounded-lg p-4 border border-[var(--color-border)]">
      <h3 className="font-semibold mb-3">Cast Your Ranked Choice Ballot</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Rank games in order of preference. Drag to reorder, or use the arrow
        buttons. Your 1st choice gets top priority.
      </p>

      {/* Current Rankings (drag-and-drop) */}
      {rankings.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm text-[var(--color-text-muted)] mb-2">
            Your Rankings
          </label>
          <div className="grid gap-1.5">
            {rankings.map((gameId, index) => {
              const game = games.find((g) => g.id === gameId)!;
              const isDragged = draggedIndex === index;
              const isOver = overIndex === index;
              return (
                <div
                  key={gameId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 bg-[var(--color-surface)] rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all ${
                    isDragged ? "opacity-40 scale-95" : ""
                  } ${
                    isOver && !isDragged
                      ? "ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-bg)]"
                      : ""
                  }`}
                >
                  <span className="text-[var(--color-text-muted)] text-xs cursor-grab">
                    ⠿
                  </span>
                  <span className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {game.title}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="w-6 h-6 flex items-center justify-center text-xs rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === rankings.length - 1}
                      className="w-6 h-6 flex items-center justify-center text-xs rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => removeFromRanking(index)}
                      className="w-6 h-6 flex items-center justify-center text-xs rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Games to Rank */}
      {availableGames.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm text-[var(--color-text-muted)] mb-2">
            Click to add to ranking
          </label>
          <div className="grid gap-1.5">
            {availableGames.map((game) => (
              <button
                key={game.id}
                onClick={() => addToRanking(game.id)}
                className="text-left bg-[var(--color-surface)] rounded-lg px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2"
              >
                <span className="text-[var(--color-text-muted)]">+</span>
                <span>{game.title}</span>
                {game.platform && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    ({game.platform})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => {
            setIsOpen(false);
            setRankings([]);
          }}
          className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || rankings.length === 0}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Ballot"}
        </button>
      </div>
    </div>
  );
}
