import getDb from "@/lib/db";
import { ElectionWithWinner } from "@/lib/types";
import Link from "next/link";

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
       ORDER BY e.created_at DESC`
    )
    .all() as ElectionWithWinner[];
}

export default function ElectionsPage() {
  const db = getDb();
  const elections = getElections(db);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Election History</h1>
      <p className="text-[var(--color-text-muted)] mb-8">
        Past monthly votes and their results
      </p>

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
                    <span>{election.status === "open" ? "🗳️" : "🏆"}</span>
                    {election.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
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
            Start a monthly vote from the{" "}
            <Link
              href="/nominations"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              Nominations
            </Link>{" "}
            page.
          </p>
        </div>
      )}
    </div>
  );
}
