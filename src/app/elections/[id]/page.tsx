import getDb from "@/lib/db";
import {
  Election,
  GameWithNominator,
  ElectionRoundWithGame,
  Member,
} from "@/lib/types";
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

function getBallots(
  db: ReturnType<typeof getDb>,
  electionId: number
): { member_id: number; game_id: number; rank: number }[] {
  return db
    .prepare(
      "SELECT member_id, game_id, rank FROM ballots WHERE election_id = ? ORDER BY member_id, rank"
    )
    .all(electionId) as { member_id: number; game_id: number; rank: number }[];
}

function getMembers(db: ReturnType<typeof getDb>): Member[] {
  return db.prepare("SELECT * FROM members ORDER BY name").all() as Member[];
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
  const db = getDb();
  const election = getElection(db, parseInt(id));
  if (!election) notFound();

  const games = getElectionGames(db, election.id);
  const rounds = getRounds(db, election.id);
  const ballots = getBallots(db, election.id);
  const members = getMembers(db);
  const winner = getWinner(db, election.winner_id);

  // Group ballots by member
  const ballotsByMember = new Map<number, { game_id: number; rank: number }[]>();
  for (const b of ballots) {
    if (!ballotsByMember.has(b.member_id)) {
      ballotsByMember.set(b.member_id, []);
    }
    ballotsByMember.get(b.member_id)!.push(b);
  }

  const gameMap = new Map(games.map((g) => [g.id, g]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/elections"
        className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] mb-4 inline-block"
      >
        ← All Elections
      </Link>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <span>{election.status === "open" ? "🗳️" : "🏆"}</span>
              {election.name}
            </h1>
            <div className="flex items-center gap-3 mb-3">
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
            <div
              key={game.id}
              className={`rounded-lg px-3 py-2 flex items-center gap-2 ${
                winner && game.id === winner.id
                  ? "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30"
                  : "bg-[var(--color-bg)]"
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
            </div>
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

      {/* Individual Ballots */}
      {ballotsByMember.size > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Ballots ({ballotsByMember.size})
          </h2>
          <div className="grid gap-3">
            {Array.from(ballotsByMember.entries()).map(
              ([memberId, memberBallots]) => {
                const member = memberMap.get(memberId);
                return (
                  <div
                    key={memberId}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {member?.avatar || "🎮"}
                      </span>
                      <span className="font-medium">
                        {member?.name || "Unknown"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {memberBallots
                        .sort((a, b) => a.rank - b.rank)
                        .map((b) => {
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
                );
              }
            )}
          </div>
        </section>
      )}
    </div>
  );
}
