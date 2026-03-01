import getDb from "@/lib/db";
import { GameWithVotes, Member } from "@/lib/types";
import NominationForm from "./NominationForm";
import VoteButton from "./VoteButton";

export const dynamic = "force-dynamic";

function getNominations(db: ReturnType<typeof getDb>): GameWithVotes[] {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName,
        (SELECT COUNT(*) FROM votes v WHERE v.game_id = g.id) as voteCount
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.status = 'nominated'
       ORDER BY voteCount DESC, g.nominated_at DESC`
    )
    .all() as GameWithVotes[];
}

function getMembers(db: ReturnType<typeof getDb>): Member[] {
  return db.prepare("SELECT * FROM members ORDER BY name").all() as Member[];
}

export default function NominationsPage() {
  const db = getDb();
  const nominations = getNominations(db);
  const members = getMembers(db);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Nominations</h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Nominate games and vote for what to play next
          </p>
        </div>
      </div>

      <NominationForm members={members} />

      <div className="grid gap-4 mt-8">
        {nominations.length > 0 ? (
          nominations.map((game) => (
            <div
              key={game.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 flex gap-5 items-start"
            >
              <VoteButton gameId={game.id} voteCount={game.voteCount} members={members} />
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
              <form action={`/api/games/${game.id}/promote`} method="POST">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs rounded-lg font-medium hover:bg-[var(--color-accent)]/30 transition-colors"
                  title="Set as current game"
                >
                  ▶ Play
                </button>
              </form>
            </div>
          ))
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
            <p className="text-lg mb-1">No nominations yet</p>
            <p className="text-sm">Use the form above to nominate your first game!</p>
          </div>
        )}
      </div>
    </div>
  );
}
