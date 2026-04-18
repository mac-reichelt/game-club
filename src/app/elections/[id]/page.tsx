import getDb from "@/lib/db";
import {
  Election,
  GameWithNominator,
  ElectionRoundWithGame,
} from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getElection(
  db: ReturnType<typeof getDb>,
  id: number
): Election | null {
  return db.prepare("SELECT * FROM elections WHERE id = ?").get(id) as
    | Election
    | null;
}

function getElectionGames(
  db: ReturnType<typeof getDb>,
  electionId: number
): GameWithNominator[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM election_games eg
       JOIN games g ON eg.game_id = g.id
       JOIN members m ON g.nominated_by = m.id
       WHERE eg.election_id = ?`
    )
    .all(electionId) as GameWithNominator[];
}

function getRounds(
  db: ReturnType<typeof getDb>,
  electionId: number
): ElectionRoundWithGame[] {
  return db
    .prepare(
      `SELECT er.*, g.title as eliminatedGameTitle
       FROM election_rounds er
       LEFT JOIN games g ON er.eliminated_game_id = g.id
       WHERE er.election_id = ?
       ORDER BY er.round_number`
    )
    .all(electionId) as ElectionRoundWithGame[];
}

function getMyBallot(
  db: ReturnType<typeof getDb>,
  electionId: number,
  memberId: number
): { game_id: number; rank: number }[] {
  return db
    .prepare(
      "SELECT game_id, rank FROM ballots WHERE election_id = ? AND member_id = ? ORDER BY rank"
    )
    .all(electionId, memberId) as { game_id: number; rank: number }[];
}

function getVoterCount(
  db: ReturnType<typeof getDb>,
  electionId: number
): number {
  return (
    db
      .prepare(
        "SELECT COUNT(DISTINCT member_id) as count FROM ballots WHERE election_id = ?"
      )
      .get(electionId) as { count: number }
  ).count;
}

function getWinner(
  db: ReturnType<typeof getDb>,
  winnerId: number | null
): GameWithNominator | null {
  if (!winnerId) return null;
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.id = ?`
    )
    .get(winnerId) as GameWithNominator | null;
}

export default async function ElectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const db = getDb();
  const election = getElection(db, parseInt(id));
  if (!election) notFound();

  const games = getElectionGames(db, election.id);
  const rounds = getRounds(db, election.id);
  const myBallot = getMyBallot(db, election.id, user.id);
  const voterCount = getVoterCount(db, election.id);
  const winner = getWinner(db, election.winner_id);

  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/elections"
        className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] mb-4 inline-block"
      >
        ← All Elections
      </Link>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <span>{election.status === "open" ? "🗳️" : "🏆"}</span>
              {election.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
              <span
                className={`inline-block px-2 py-0.5 text-xs rounded ${
                  election.status === "open"
                    ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                    : "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                }`}
              >
                {election.status}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">
                {voterCount} voter(s)
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">
                Created {new Date(election.created_at).toLocaleDateString()}
              </span>
              {election.closed_at && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  · Closed{" "}
                  {new Date(election.closed_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {winner && (
            <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg p-3 text-center">
              <div className="text-xs text-[var(--color-accent)] mb-1">
                🏆 Winner
              </div>
              <div className="font-bold text-lg">{winner.title}</div>
              {winner.platform && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  {winner.platform}
                </div>
              )}
            </div>
          )}
        </div>

        <h3 className="font-medium text-sm text-[var(--color-text-muted)] mb-2">
          Candidates ({games.length})
        </h3>
        <div className="grid gap-2">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className={`rounded-lg px-3 py-2 flex items-center gap-2 transition-colors ${
                winner && game.id === winner.id
                  ? "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/20"
                  : "bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {winner && game.id === winner.id && (
                <span className="text-sm">🏆</span>
              )}
              <span className="font-medium text-sm">{game.title}</span>
              {game.platform && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  ({game.platform})
                </span>
              )}
              <span className="text-xs text-[var(--color-text-muted)]">
                — {game.nominatorName}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* RCV Rounds */}
      {rounds.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Ranked Choice Tally ({rounds.length} round
            {rounds.length !== 1 ? "s" : ""})
          </h2>
          <div className="grid gap-3">
            {rounds.map((round) => (
              <div
                key={round.id}
                className={`bg-[var(--color-surface)] border rounded-lg p-4 ${
                  !round.eliminated_game_id
                    ? "border-[var(--color-accent)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">
                    Round {round.round_number}
                  </span>
                  {round.eliminatedGameTitle && (
                    <span className="text-xs text-[var(--color-danger)]">
                      Eliminated: {round.eliminatedGameTitle}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {round.summary}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your Ballot (private — only show the logged-in user's ballot) */}
      {myBallot.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Your Ballot</h2>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              {myBallot.map((b) => {
                const game = gameMap.get(b.game_id);
                return (
                  <span
                    key={b.rank}
                    className="inline-flex items-center gap-1.5 bg-[var(--color-bg)] rounded px-2 py-1"
                  >
                    <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs flex items-center justify-center font-bold">
                      {b.rank}
                    </span>
                    <span className="text-sm">
                      {game?.title || "Unknown"}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {myBallot.length === 0 && election.status === "closed" && (
        <section>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-center text-sm text-[var(--color-text-muted)]">
            You did not vote in this election.
          </div>
        </section>
      )}
    </div>
  );
}
