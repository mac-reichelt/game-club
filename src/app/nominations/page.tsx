import getDb from "@/lib/db";
import { GameWithNominator, Election, StoreLink } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { checkAndCloseExpiredElections } from "@/lib/elections";
import NominationForm from "./NominationForm";
import BallotForm from "./BallotForm";
import CountdownTimer from "@/components/CountdownTimer";

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

function getStoreIcon(storeName: string): string {
  const icons: Record<string, string> = {
    "Steam": "🎮",
    "PlayStation Store": "🎮",
    "Xbox Store": "🎮",
    "Nintendo Store": "🎮",
    "Epic Games": "🎮",
    "GOG": "🎮",
    "App Store": "📱",
    "Google Play": "📱",
    "itch.io": "🕹️",
  };
  return icons[storeName] || "🔗";
}

export default async function NominationsPage() {
  const user = await requireAuth();
  const db = getDb();

  // Auto-close expired elections
  checkAndCloseExpiredElections(db);

  const nominations = getNominations(db);
  const openElection = getOpenElection(db);
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

        <div className="grid gap-3">
          {nominations.length > 0 ? (
            nominations.map((game) => {
              let stores: StoreLink[] = [];
              try {
                if (game.stores_json) stores = JSON.parse(game.stores_json);
              } catch { /* ignore */ }
              const trailerUrl = game.trailer_url || "";
              const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(game.title + " official trailer")}`;

              return (
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

                  {/* Store links + trailer */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                    {stores.map((store) => (
                        <a
                          key={store.url}
                          href={store.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                          title={`View on ${store.name}`}
                        >
                          <span>{getStoreIcon(store.name)}</span>
                          {store.name}
                        </a>
                      ))}
                      {trailerUrl ? (
                        <a
                          href={trailerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Watch trailer"
                        >
                          <span>▶</span> Trailer
                        </a>
                      ) : (
                        <a
                          href={youtubeSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Search for trailer on YouTube"
                        >
                          <span>▶</span> Find Trailer
                        </a>
                      )}
                    </div>
                </div>
              </div>
              );
            })
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
