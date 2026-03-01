import getDb from "@/lib/db";
import { GameWithVotes } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getCompletedGames(db: ReturnType<typeof getDb>): GameWithVotes[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName,
        (SELECT COUNT(*) FROM votes v WHERE v.game_id = g.id) as voteCount
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'completed'
       ORDER BY g.completed_date DESC`
    )
    .all() as GameWithVotes[];
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null)
    return (
      <span className="text-sm text-[var(--color-text-muted)]">Unrated</span>
    );
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-sm ${i <= Math.round(rating) ? "text-[var(--color-star)]" : "text-[var(--color-border)]"}`}
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-sm text-[var(--color-text-muted)]">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

export default function HistoryPage() {
  const db = getDb();
  const games = getCompletedGames(db);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Game History</h1>
      <p className="text-[var(--color-text-muted)] mb-8">
        All the games we&apos;ve played together
      </p>

      {games.length > 0 ? (
        <div className="grid gap-4">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/history/${game.id}`}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 flex gap-5 hover:border-[var(--color-primary)] transition-colors"
            >
              <div className="w-20 h-28 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-3xl shrink-0">
                {game.image_url || "🎮"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1">{game.title}</h3>
                <div className="flex items-center gap-3 mb-2">
                  {game.platform && (
                    <span className="inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded">
                      {game.platform}
                    </span>
                  )}
                  <Stars rating={game.avg_rating} />
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Nominated by {game.nominatorName}
                  {game.completed_date &&
                    ` · Completed ${new Date(game.completed_date).toLocaleDateString()}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
          <p className="text-lg mb-1">No completed games yet</p>
          <p className="text-sm">
            Games will appear here once marked as completed.
          </p>
        </div>
      )}
    </div>
  );
}
