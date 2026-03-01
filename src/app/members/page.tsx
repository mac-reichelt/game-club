import getDb from "@/lib/db";
import { Member } from "@/lib/types";
import AddMemberForm from "./AddMemberForm";

export const dynamic = "force-dynamic";

interface MemberWithStats extends Member {
  nominationCount: number;
  ballotCount: number;
  reviewCount: number;
}

function getMembersWithStats(
  db: ReturnType<typeof getDb>
): MemberWithStats[] {
  return db
    .prepare(
      `SELECT m.*,
        m.joined_at as joinedAt,
        (SELECT COUNT(*) FROM games g WHERE g.nominated_by = m.id) as nominationCount,
        (SELECT COUNT(DISTINCT election_id) FROM ballots b WHERE b.member_id = m.id) as ballotCount,
        (SELECT COUNT(*) FROM reviews r WHERE r.member_id = m.id) as reviewCount
       FROM members m
       ORDER BY m.name`
    )
    .all() as MemberWithStats[];
}

export default function MembersPage() {
  const db = getDb();
  const members = getMembersWithStats(db);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} in the club
          </p>
        </div>
      </div>

      <AddMemberForm />

      <div className="grid grid-cols-2 gap-4 mt-6">
        {members.map((member) => (
          <div
            key={member.id}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{member.avatar}</span>
              <div>
                <h3 className="font-semibold text-lg">{member.name}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[var(--color-bg)] rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold">
                  {member.nominationCount}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Noms
                </div>
              </div>
              <div className="bg-[var(--color-bg)] rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold">{member.ballotCount}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Votes
                </div>
              </div>
              <div className="bg-[var(--color-bg)] rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold">{member.reviewCount}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Reviews
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)] mt-6">
          <p className="text-lg mb-1">No members yet</p>
          <p className="text-sm">Add the first member to get started!</p>
        </div>
      )}
    </div>
  );
}
