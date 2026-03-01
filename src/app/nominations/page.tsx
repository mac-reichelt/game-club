import getDb from "@/lib/db";
import { GameWithNominator, Member, Election } from "@/lib/types";
import NominationForm from "./NominationForm";
import BallotForm from "./BallotForm";
import StartElectionButton from "./StartElectionButton";
import CloseElectionButton from "./CloseElectionButton";

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

function getMembers(db: ReturnType<typeof getDb>): Member[] {
  return db.prepare("SELECT * FROM members ORDER BY name").all() as Member[];
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

export default function NominationsPage() {
  const db = getDb();
  const nominations = getNominations(db);
  const members = getMembers(db);
  const openElection = getOpenElection(db);

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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span>🗳️</span> {openElection.election.name}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Ranked Choice Voting · {openElection.voterIds.length} vote(s)
                  cast · {openElection.games.length} candidates
                </p>
              </div>
              <CloseElectionButton
                electionId={openElection.election.id}
                voteCount={openElection.voterIds.length}
              />
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
              members={members}
              voterIds={openElection.voterIds}
            />
          </div>
        </section>
      )}

      {/* Nominate */}
      <NominationForm members={members} />

      {/* Nominations List */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Nominated Games ({nominations.length})
          </h2>
          {!openElection && nominations.length >= 2 && (
            <StartElectionButton games={nominations} />
          )}
        </div>

        <div className="grid gap-3">
          {nominations.length > 0 ? (
            nominations.map((game) => (
              <div
                key={game.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold">{game.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {game.platform && (
                      <span className="inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded">
                        {game.platform}
                      </span>
                    )}
                    <span className="text-sm text-[var(--color-text-muted)]">
                      Nominated by {game.nominatorName}
                    </span>
                  </div>
                  {game.description && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                      {game.description}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
              <p className="text-lg mb-1">No nominations yet</p>
              <p className="text-sm">
                Use the form above to nominate your first game!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
