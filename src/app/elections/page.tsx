import getDb from "@/lib/db";
import { ElectionWithWinner, GameWithNominator, Election } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { checkAndCloseExpiredElections } from "@/lib/elections";
import Link from "next/link";
import StartElectionButton from "./StartElectionButton";
import CloseElectionButton from "./CloseElectionButton";
import CountdownTimer from "@/components/CountdownTimer";

export const dynamic = "force-dynamic";

function getElections(db: ReturnType<typeof getDb>): ElectionWithWinner[] {
  return db
    .prepare(
      `SELECT e.*,
        g.title as winnerTitle,
        g.platform as winnerPlatform,
        (SELECT COUNT(DISTINCT b.member_id) FROM ballots b WHERE b.election_id = e.id) as ballotCount
       FROM elections e
       LEFT JOIN games g ON e.winner_id = g.id
       WHERE e.status = 'closed'
       ORDER BY e.created_at DESC`
    )
    .all() as ElectionWithWinner[];
}

function getOpenElection(db: ReturnType<typeof getDb>) {
  const election = db
    .prepare("SELECT * FROM elections WHERE status = 'open' LIMIT 1")
    .get() as Election | undefined;

  if (!election) return null;

  const games = db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM election_games eg
       JOIN games g ON eg.game_id = g.id
       JOIN members m ON g.nominated_by = m.id
       WHERE eg.election_id = ?`
    )
    .all(election.id) as GameWithNominator[];

  const voteCount = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT member_id) as count FROM ballots WHERE election_id = ?"
      )
      .get(election.id) as { count: number }
  ).count;

  return { election, games, voteCount };
}

function getNominatedGames(db: ReturnType<typeof getDb>): GameWithNominator[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'nominated'
       ORDER BY g.nominated_at DESC`
    )
    .all() as GameWithNominator[];
}

export default async function ElectionsPage() {
  await requireAuth();
  const db = getDb();

  checkAndCloseExpiredElections(db);

  const elections = getElections(db);
  const openElection = getOpenElection(db);
  const nominations = getNominatedGames(db);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Elections</h1>
        {!openElection && nominations.length >= 2 && (
          <StartElectionButton games={nominations} />
        )}
      </div>
      <p className="text-[var(--color-text-muted)] mb-8">
        Monthly votes and their results
      </p>

      {/* Open Election */}
      {openElection && (
        <section className="mb-8">
          <div className="bg-[var(--color-surface)] border-2 border-[var(--color-accent)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span>🗳️</span> {openElection.election.name}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {openElection.voteCount} vote(s) cast ·{" "}
                  {openElection.games.length} candidates
                </p>
              </div>
              <div className="flex items-center gap-3">
                {openElection.election.closes_at && (
                  <CountdownTimer closesAt={openElection.election.closes_at} />
                )}
                <CloseElectionButton
                  electionId={openElection.election.id}
                  voteCount={openElection.voteCount}
                />
              </div>
            </div>
            <div className="grid gap-2">
              {openElection.games.map((game) => (
                <div
                  key={game.id}
                  className="bg-[var(--color-bg)] rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="font-medium text-sm">{game.title}</span>
                  {game.platform && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ({game.platform})
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              Cast your ballot on the{" "}
              <Link
                href="/nominations"
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
              >
                Nominations
              </Link>{" "}
              page.
            </p>
          </div>
        </section>
      )}

      {/* Past Elections */}
      <h2 className="text-xl font-semibold mb-4">Past Elections</h2>
      {elections.length > 0 ? (
        <div className="grid gap-4">
          {elections.map((election) => (
            <Link
              key={election.id}
              href={`/elections/${election.id}`}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>🏆</span>
                    {election.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {election.ballotCount} voter(s)
                    </span>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {new Date(election.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {election.winnerTitle && (
                  <div className="text-right">
                    <div className="text-sm text-[var(--color-text-muted)]">
                      Winner
                    </div>
                    <div className="font-semibold text-[var(--color-accent)]">
                      {election.winnerTitle}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
          <p className="text-lg mb-1">No elections yet</p>
          <p className="text-sm">
            {nominations.length >= 2
              ? "Start a monthly vote using the button above."
              : "Nominate at least 2 games to start an election."}
          </p>
        </div>
      )}
    </div>
  );
}
