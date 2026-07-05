import getDb from "@/lib/db";
import { GameWithNominator } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { checkAndCloseExpiredElections } from "@/lib/elections";
import { getGamedbDetail, isGamedbConfigured } from "@/lib/gamedb";
import NominationForm from "./NominationForm";
import NominationsList, { NominationGamedbInfo } from "./NominationsList";
import { getNominationStats } from "./nominationStats";

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

async function getNominationGamedbInfo(
  nominations: GameWithNominator[]
): Promise<Record<number, NominationGamedbInfo>> {
  if (!isGamedbConfigured()) return {};

  const entries = await Promise.all(
    nominations.map(async (game) => {
      if (!game.gamedb_id) return null;
      try {
        const detail = await getGamedbDetail(game.gamedb_id);
        if (!detail) return null;

        const opencriticScore =
          detail.opencritic?.score != null
            ? Math.round(detail.opencritic.score)
            : null;
        const opencriticTier = detail.opencritic?.tier ?? null;
        const hltb = detail.hltb
          ? {
              mainStoryHours: detail.hltb.main_story_hours,
              mainExtraHours: detail.hltb.main_extra_hours,
              completionistHours: detail.hltb.completionist_hours,
            }
          : null;
        const hasHltbHours =
          hltb?.mainStoryHours != null ||
          hltb?.mainExtraHours != null ||
          hltb?.completionistHours != null;

        if (opencriticScore == null && !hasHltbHours) return null;

        return [
          game.id,
          {
            opencritic:
              opencriticScore != null
                ? { score: opencriticScore, tier: opencriticTier }
                : null,
            hltb: hasHltbHours ? hltb : null,
          } satisfies NominationGamedbInfo,
        ] as const;
      } catch (err) {
        console.error("nominations gamedb lookup failed:", err);
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [number, NominationGamedbInfo] => !!entry));
}

export default async function NominationsPage() {
  await requireAuth();
  const db = getDb();

  // Auto-close expired elections
  checkAndCloseExpiredElections(db);

  const nominations = getNominations(db);
  const electionHistory = getElectionHistory(db);
  const stats = getNominationStats(db);
  const gamedbInfo = await getNominationGamedbInfo(nominations);
  const gamedbConfigured = isGamedbConfigured();

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
            gamedbInfo={gamedbInfo}
            gamedbConfigured={gamedbConfigured}
          />
        )}
      </div>
    </div>
  );
}
