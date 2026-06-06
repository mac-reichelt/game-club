import getDb from "@/lib/db";
import { GameWithNominator } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { checkAndCloseExpiredElections } from "@/lib/elections";
import NominationForm from "./NominationForm";
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
  // Election ballot appearances are the source of truth for "first/last/times
  // nominated". The games.nominated_at column is only a fallback for games
  // that have never been on a ballot (because legacy seed data set it to a
  // bulk import date that doesn't reflect real nomination history).
  const rows = db
    .prepare(
      `SELECT g.id as game_id,
              g.nominated_at as current_nominated_at,
              MIN(e.created_at) as first_election_at,
              MAX(e.created_at) as last_election_at,
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
      first_election_at: string | null;
      last_election_at: string | null;
      election_count: number;
    }[];

  const out: Record<number, NominationStats> = {};
  for (const r of rows) {
    const hasElections = r.election_count > 0 && r.first_election_at && r.last_election_at;
    out[r.game_id] = {
      gameId: r.game_id,
      timesNominated: hasElections ? r.election_count : 1,
      firstNominatedAt: hasElections ? r.first_election_at! : r.current_nominated_at,
      lastNominatedAt: hasElections ? r.last_election_at! : r.current_nominated_at,
    };
  }
  return out;
}

export default async function NominationsPage() {
  await requireAuth();
  const db = getDb();

  // Auto-close expired elections
  checkAndCloseExpiredElections(db);

  const nominations = getNominations(db);
  const electionHistory = getElectionHistory(db);
  const stats = getNominationStats(db);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nominations</h1>
        <p className="text-[var(--color-text-muted)] mt-1">
          Nominate games and browse what should be on the next ballot
        </p>
      </div>

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
