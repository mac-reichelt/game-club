import getDb from "@/lib/db";
import { GameWithVotes } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getCurrentGame(db: ReturnType<typeof getDb>): GameWithVotes | null {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName,
        (SELECT COUNT(*) FROM votes v WHERE v.game_id = g.id) as voteCount
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'current'
       LIMIT 1`
    )
    .get() as GameWithVotes | null;
}

function getUpcomingGames(db: ReturnType<typeof getDb>): GameWithVotes[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName,
        (SELECT COUNT(*) FROM votes v WHERE v.game_id = g.id) as voteCount
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'nominated'
       ORDER BY voteCount DESC
       LIMIT 5`
    )
    .all() as GameWithVotes[];
}

function getRecentlyCompleted(db: ReturnType<typeof getDb>): GameWithVotes[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName,
        (SELECT COUNT(*) FROM votes v WHERE v.game_id = g.id) as voteCount
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'completed'
       ORDER BY g.completed_date DESC
       LIMIT 3`
    )
    .all() as GameWithVotes[];
}

function getStats(db: ReturnType<typeof getDb>) {
  const memberCount = (
    db.prepare("SELECT COUNT(*) as count FROM members").get() as {
      count: number;
    }
  ).count;
  const completedCount = (
    db
      .prepare("SELECT COUNT(*) as count FROM games WHERE status = 'completed'")
      .get() as { count: number }
  ).count;
  const nominationCount = (
    db
      .prepare("SELECT COUNT(*) as count FROM games WHERE status = 'nominated'")
      .get() as { count: number }
  ).count;
  return { memberCount, completedCount, nominationCount };
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-[var(--color-text-muted)]">No ratings</span>;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= Math.round(rating) ? "text-[var(--color-star)]" : "text-[var(--color-border)]"}
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

export default function Dashboard() {
  const db = getDb();
  const currentGame = getCurrentGame(db);
  const upcoming = getUpcomingGames(db);
  const recent = getRecentlyCompleted(db);
  const stats = getStats(db);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Members", value: stats.memberCount, icon: "👥" },
          { label: "Games Completed", value: stats.completedCount, icon: "✅" },
          { label: "Nominations", value: stats.nominationCount, icon: "🎯" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-sm text-[var(--color-text-muted)]">
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Currently Playing */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span>🕹️</span> Currently Playing
        </h2>
        {currentGame ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl p-6 flex gap-6">
            <div className="w-32 h-44 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-5xl shrink-0">
              {currentGame.image_url || "🎮"}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-1">{currentGame.title}</h3>
              {currentGame.platform && (
                <span className="inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded mb-2">
                  {currentGame.platform}
                </span>
              )}
              <p className="text-[var(--color-text-muted)] text-sm mb-3">
                {currentGame.description || "No description"}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Nominated by{" "}
                <span className="text-[var(--color-text)]">
                  {currentGame.nominatorName}
                </span>
                {currentGame.scheduled_date &&
                  ` · Started ${new Date(currentGame.scheduled_date).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
            <p className="text-lg mb-2">No game currently being played</p>
            <Link
              href="/nominations"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium"
            >
              Vote on nominations →
            </Link>
          </div>
        )}
      </section>

      {/* Top Nominations */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>🎯</span> Top Nominations
          </h2>
          <Link
            href="/nominations"
            className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            View all →
          </Link>
        </div>
        {upcoming.length > 0 ? (
          <div className="grid gap-3">
            {upcoming.map((game, idx) => (
              <div
                key={game.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 flex items-center gap-4"
              >
                <span className="text-lg font-bold text-[var(--color-text-muted)] w-6 text-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{game.title}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    by {game.nominatorName}
                    {game.platform && ` · ${game.platform}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[var(--color-accent)] font-semibold">
                  <span>▲</span> {game.voteCount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 text-center text-[var(--color-text-muted)]">
            No nominations yet.{" "}
            <Link
              href="/nominations"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              Nominate a game →
            </Link>
          </div>
        )}
      </section>

      {/* Recently Completed */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>✅</span> Recently Completed
          </h2>
          <Link
            href="/history"
            className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            Full history →
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {recent.map((game) => (
              <Link
                key={game.id}
                href={`/history/${game.id}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="w-full h-28 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-4xl mb-3">
                  {game.image_url || "🎮"}
                </div>
                <h3 className="font-semibold truncate mb-1">{game.title}</h3>
                <Stars rating={game.avg_rating} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 text-center text-[var(--color-text-muted)]">
            No completed games yet.
          </div>
        )}
      </section>
    </div>
  );
}
