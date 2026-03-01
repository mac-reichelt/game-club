"use client";

import { Member } from "@/lib/types";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoteButton({
  gameId,
  voteCount,
  members,
}: {
  gameId: number;
  voteCount: number;
  members: Member[];
}) {
  const router = useRouter();
  const [showVoter, setShowVoter] = useState(false);

  async function vote(memberId: number) {
    await fetch(`/api/games/${gameId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setShowVoter(false);
    router.refresh();
  }

  return (
    <div className="relative flex flex-col items-center gap-1">
      <button
        onClick={() => setShowVoter(!showVoter)}
        className="w-12 h-12 flex flex-col items-center justify-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        <span className="text-xs">▲</span>
        <span className="text-sm font-bold">{voteCount}</span>
      </button>

      {showVoter && (
        <div className="absolute top-14 left-0 z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-2 min-w-[140px]">
          <p className="text-xs text-[var(--color-text-muted)] px-2 py-1">
            Vote as:
          </p>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => vote(m.id)}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {m.avatar} {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
