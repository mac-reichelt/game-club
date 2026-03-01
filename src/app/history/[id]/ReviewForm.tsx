"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({ gameId }: { gameId: number }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch(`/api/games/${gameId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        comment: formData.get("comment"),
      }),
    });

    if (res.ok) {
      form.reset();
      setRating(0);
      setIsOpen(false);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to submit review");
    }
    setSubmitting(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-lg p-3 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        + Write a Review
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-lg p-4"
    >
      <h3 className="font-semibold mb-3">Write a Review</h3>
      <div className="mb-3">
        <label className="block text-sm text-[var(--color-text-muted)] mb-1">
          Rating *
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHoveredRating(i)}
              onMouseLeave={() => setHoveredRating(0)}
              className={`text-2xl transition-colors ${
                i <= (hoveredRating || rating)
                  ? "text-[var(--color-star)]"
                  : "text-[var(--color-border)]"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-sm text-[var(--color-text-muted)] mb-1">
          Comment
        </label>
        <textarea
          name="comment"
          rows={2}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
          placeholder="What did you think?"
        />
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
          disabled={submitting || rating === 0}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
