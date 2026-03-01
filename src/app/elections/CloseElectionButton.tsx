"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseElectionButton({
  electionId,
  voteCount,
}: {
  electionId: number;
  voteCount: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function closeElection() {
    if (voteCount === 0) {
      alert("No votes have been cast yet!");
      return;
    }
    if (!confirm("Close this election and tally the results?")) return;

    setSubmitting(true);
    const res = await fetch(`/api/elections/${electionId}/close`, {
      method: "POST",
    });

    if (res.ok) {
      router.push(`/elections/${electionId}`);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to close election");
    }
    setSubmitting(false);
  }

  return (
    <button
      onClick={closeElection}
      disabled={submitting || voteCount === 0}
      className="px-4 py-2 bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-sm rounded-lg font-medium hover:bg-[var(--color-accent)]/30 transition-colors disabled:opacity-50"
    >
      {submitting ? "Tallying..." : "Close & Tally"}
    </button>
  );
}
