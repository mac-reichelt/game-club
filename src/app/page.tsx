import getDb from "@/lib/db";
import { GameWithNominator } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { checkAndCloseExpiredElections, getOpenElectionData } from "@/lib/elections";
import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";
import BallotForm from "./nominations/BallotForm";

export const dynamic = "force-dynamic";

function getCurrentGame(db: ReturnType<typeof getDb>): GameWithNominator | null {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'current'
       LIMIT 1`
    )
    .get() as GameWithNominator | null;
}

function getRecentlyCompleted(db: ReturnType<typeof getDb>): GameWithNominator[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'completed'
       ORDER BY g.completed_date DESC
       LIMIT 6`
    )
    .all() as GameWithNominator[];
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-[var(--color-text-muted)] text-sm">No ratings</span>;
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

export default async function Dashboard() {
  const user = await requireAuth();
  const db = getDb();
  checkAndCloseExpiredElections(db);
  const currentGame = getCurrentGame(db);
  const recent = getRecentlyCompleted(db);
  const openElection = getOpenElectionData(db);
  const hasVoted = openElection ? openElection.voterIds.includes(user.id) : false;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {openElection && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🗳️</span> Active Election
          </h2>
          <div className="bg-[var(--color-surface)] border-2 border-[var(--color-accent)] rounded-xl p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xl font-semibold">{openElection.election.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {openElection.voteCount} vote(s) cast · {openElection.games.length} candidates
                </p>
              </div>
              {openElection.election.closes_at && (
                <CountdownTimer closesAt={openElection.election.closes_at} />
              )}
            </div>
            <div className="grid gap-2 mb-4">
              {openElection.games.map((game) => (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="bg-[var(--color-bg)] rounded-lg p-3 flex items-center gap-3 hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <span className="font-medium text-sm">{game.title}</span>
                  {game.platform && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ({game.platform})
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <BallotForm
              electionId={openElection.election.id}
              games={openElection.games}
              hasVoted={hasVoted}
            />
          </div>
        </section>
      )}

      {/* Currently Playing */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span>🕹️</span> Currently Playing
        </h2>
        {currentGame ? (
          <Link
            href={`/games/${currentGame.id}`}
            className="block bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl p-4 md:p-6 flex flex-col sm:flex-row gap-4 md:gap-6 hover:border-[var(--color-primary-hover)] transition-colors"
          >
            <div className="w-full sm:w-32 h-32 sm:h-44 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-5xl shrink-0">
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
                <span className="text-[var(--color-text)]">{currentGame.nominatorName}</span>
                {currentGame.scheduled_date &&
                  ` · Started ${new Date(currentGame.scheduled_date).toLocaleDateString()}`}
              </p>
            </div>
          </Link>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
            <p className="text-lg mb-2">No game currently being played</p>
            <Link
              href="/nominations"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium"
            >
              {openElection ? "Browse nominations →" : "Nominate and start a vote →"}
            </Link>
          </div>
        )}
      </section>

      {/* Recently Completed */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span>✅</span> Recently Completed
        </h2>
        {recent.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
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
