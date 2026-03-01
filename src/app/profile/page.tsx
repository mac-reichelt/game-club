import getDb from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireAuth();
  const db = getDb();

  const stats = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM games WHERE nominated_by = ?) as nominations,
        (SELECT COUNT(DISTINCT election_id) FROM ballots WHERE member_id = ?) as votes,
        (SELECT COUNT(*) FROM reviews WHERE member_id = ?) as reviews,
        (SELECT COUNT(*) FROM games WHERE nominated_by = ? AND status = 'completed') as wins`
    )
    .get(user.id, user.id, user.id, user.id) as {
      nominations: number;
      votes: number;
      reviews: number;
      wins: number;
    };

  // Get election win details (games this user nominated that won)
  const electionWins = db
    .prepare(
      `SELECT e.name as electionName, g.title as gameTitle
       FROM elections e
       JOIN games g ON e.winner_id = g.id
       WHERE g.nominated_by = ? AND e.status = 'closed'
       ORDER BY e.closed_at DESC`
    )
    .all(user.id) as { electionName: string; gameTitle: string }[];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{user.avatar}</span>
          <div>
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Joined {new Date(user.joined_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{stats.nominations}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Nominations
          </div>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{stats.votes}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Elections Voted
          </div>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{stats.reviews}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Reviews
          </div>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{stats.wins}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Picks Won
          </div>
        </div>
      </div>

      {/* Election wins */}
      {electionWins.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
            🏆 Your nominations that won
          </h2>
          <div className="grid gap-2">
            {electionWins.map((win, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-amber-400">★</span>
                <span className="font-medium">{win.gameTitle}</span>
                <span className="text-[var(--color-text-muted)]">
                  — {win.electionName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit forms */}
      <ProfileForm user={user} />
    </div>
  );
}
