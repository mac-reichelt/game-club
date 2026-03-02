import getDb from "@/lib/db";
import { GameWithNominator, ReviewWithMember } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";

function getGame(
  db: ReturnType<typeof getDb>,
  id: number
): GameWithNominator | null {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.id = ?`
    )
    .get(id) as GameWithNominator | null;
}

function getReviews(
  db: ReturnType<typeof getDb>,
  gameId: number
): ReviewWithMember[] {
  return db
    .prepare(
      `SELECT r.*, m.name as memberName, m.avatar as memberAvatar
       FROM reviews r
       JOIN members m ON r.member_id = m.id
       WHERE r.game_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(gameId) as ReviewWithMember[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            i <= rating
              ? "text-[var(--color-star)]"
              : "text-[var(--color-border)]"
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth();
  const db = getDb();
  const game = getGame(db, parseInt(id));
  if (!game) notFound();

  const reviews = getReviews(db, game.id);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
          <div className="w-full sm:w-36 h-36 sm:h-48 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-5xl shrink-0">
            {game.image_url || "🎮"}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">{game.title}</h1>
                <div className="flex items-center gap-2 mb-3">
                  {game.platform && (
                    <span className="inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded">
                      {game.platform}
                    </span>
                  )}
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded ${
                      game.status === "current"
                        ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                        : game.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                    }`}
                  >
                    {game.status}
                  </span>
                </div>
              </div>
              {game.avg_rating !== null && (
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {game.avg_rating.toFixed(1)}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    avg rating
                  </div>
                </div>
              )}
            </div>
            {game.description && (
              <p className="text-[var(--color-text-muted)] text-sm mb-3">
                {game.description}
              </p>
            )}
            <p className="text-sm text-[var(--color-text-muted)]">
              Nominated by{" "}
              <span className="text-[var(--color-text)]">
                {game.nominatorName}
              </span>
              {game.scheduled_date &&
                ` · Started ${new Date(game.scheduled_date).toLocaleDateString()}`}
              {game.completed_date &&
                ` · Completed ${new Date(game.completed_date).toLocaleDateString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Reviews ({reviews.length})
        </h2>

        {game.status === "completed" && (
          <ReviewForm gameId={game.id} />
        )}

        {reviews.length > 0 ? (
          <div className="grid gap-3 mt-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">{review.memberAvatar}</span>
                  <span className="font-medium">{review.memberName}</span>
                  <Stars rating={review.rating} />
                  <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-[var(--color-text-muted)] ml-9">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 text-center text-[var(--color-text-muted)] mt-4">
            No reviews yet.
          </div>
        )}
      </div>
    </div>
  );
}
