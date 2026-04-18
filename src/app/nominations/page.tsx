import getDb from "@/lib/db";
import { GameWithNominator, Election } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { checkAndCloseExpiredElections } from "@/lib/elections";
import NominationForm from "./NominationForm";
import BallotForm from "./BallotForm";
import CountdownTimer from "@/components/CountdownTimer";
import NominationsList, { NominationStats } from "./NominationsList";

export const dynamic = "force-dynamic";

function getNominations(db: ReturnType<typeof getDb>): GameWithNominator[] {
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

  const voters = db
    .prepare(
      "SELECT DISTINCT member_id FROM ballots WHERE election_id = ?"
    )
    .all(election.id) as { member_id: number }[];

  return { election, games, voterIds: voters.map((v) => v.member_id) };
}

function getElectionHistory(db: ReturnType<typeof getDb>): Record<number, { id: number; name: string; closed_at: string | null }[]> {
  const rows = db
    .prepare(
      `SELECT eg.game_id, e.id, e.name, e.closed_at
       FROM election_games eg
       JOIN elections e ON eg.election_id = e.id
       WHERE e.status = 'closed'
       ORDER BY e.closed_at DESC`
    )
    .all() as { game_id: number; id: number; name: string; closed_at: string | null }[];

  const map: Record<number, { id: number; name: string; closed_at: string | null }[]> = {};
  for (const row of rows) {
    if (!map[row.game_id]) map[row.game_id] = [];
    map[row.game_id].push({ id: row.id, name: row.name, closed_at: row.closed_at });
  }
  return map;
}

function getNominationStats(db: ReturnType<typeof getDb>): Record<number, NominationStats> {
  // Aggregate from election_games joined with elections, plus the game's own
  // nominated_at (the current/active nomination).
  const rows = db
    .prepare(
      `SELECT g.id as game_id,
              g.nominated_at as current_nominated_at,
              MIN(COALESCE(e.created_at, g.nominated_at)) as first_at,
              MAX(COALESCE(e.created_at, g.nominated_at)) as last_at,
              COUNT(DISTINCT e.id) as election_count
       FROM games g
       LEFT JOIN election_games eg ON eg.game_id = g.id
       LEFT JOIN elections e ON e.id = eg.election_id
       WHERE g.status = 'nominated'
       GROUP BY g.id`
    )
    .all() as {
      game_id: number;
      current_nominated_at: string;
      first_at: string;
      last_at: string;
      election_count: number;
    }[];

  const out: Record<number, NominationStats> = {};
  for (const r of rows) {
    const first = r.first_at < r.current_nominated_at ? r.first_at : r.current_nominated_at;
    const last = r.last_at > r.current_nominated_at ? r.last_at : r.current_nominated_at;
    out[r.game_id] = {
      gameId: r.game_id,
      timesNominated: r.election_count + 1,
      firstNominatedAt: first,
      lastNominatedAt: last,
    };
  }
  return out;
}

export default async function NominationsPage() {
  const user = await requireAuth();
  const db = getDb();

  // Auto-close expired elections
  checkAndCloseExpiredElections(db);

  const nominations = getNominations(db);
  const openElection = getOpenElection(db);
  const electionHistory = getElectionHistory(db);
  const stats = getNominationStats(db);
  const hasVoted = openElection
    ? openElection.voterIds.includes(user.id)
    : false;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nominations</h1>
        <p className="text-[var(--color-text-muted)] mt-1">
          Nominate games and vote for what to play next
        </p>
      </div>

      {/* Active Election */}
      {openElection && (
        <section className="mb-8">
          <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)] rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span>🗳️</span> {openElection.election.name}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Ranked Choice Voting · {openElection.voterIds.length} vote(s)
                  cast · {openElection.games.length} candidates
                </p>
              </div>
              {openElection.election.closes_at && (
                <CountdownTimer closesAt={openElection.election.closes_at} />
              )}
            </div>

            <div className="grid gap-2 mb-4">
              {openElection.games.map((game) => (
                <div
                  key={game.id}
                  className="bg-[var(--color-bg)] rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{game.title}</span>
                    {game.platform && (
                      <span className="ml-2 inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded">
                        {game.platform}
                      </span>
                    )}
                    <span className="text-sm text-[var(--color-text-muted)] ml-2">
                      by {game.nominatorName}
                    </span>
                  </div>
                </div>
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

      {/* Nominate */}
      <NominationForm />

      {/* Nominations List */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">
          Nominated Games ({nominations.length})
        </h2>

        {nominations.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
            <p className="text-lg mb-1">No nominations yet</p>
            <p className="text-sm">
              Use the form above to nominate your first game!
            </p>
          </div>
        ) : (
          <NominationsList
            nominations={nominations}
            stats={stats}
            electionHistory={electionHistory}
          />
        )}
      </div>
    </div>
  );
}
