import type Database from "better-sqlite3";
import { NominationStats } from "./NominationsList";

type NominationStatsRow = {
  game_id: number;
  first_election_at: string | null;
  last_election_at: string | null;
  election_count: number;
};

export function mapNominationStatsRows(
  rows: NominationStatsRow[]
): Record<number, NominationStats> {
  const out: Record<number, NominationStats> = {};

  for (const r of rows) {
    const hasElections =
      r.election_count > 0 && r.first_election_at && r.last_election_at;
    out[r.game_id] = {
      gameId: r.game_id,
      timesNominated: hasElections ? r.election_count : 1,
      firstNominatedAt: hasElections ? r.first_election_at : null,
      lastNominatedAt: hasElections ? r.last_election_at : null,
    };
  }

  return out;
}

export function getNominationStats(
  db: Database.Database
): Record<number, NominationStats> {
  const rows = db
    .prepare(
      `SELECT g.id as game_id,
              MIN(e.created_at) as first_election_at,
              MAX(e.created_at) as last_election_at,
              COUNT(DISTINCT e.id) as election_count
       FROM games g
       LEFT JOIN election_games eg ON eg.game_id = g.id
       LEFT JOIN elections e ON e.id = eg.election_id
       WHERE g.status = 'nominated'
       GROUP BY g.id`
    )
    .all() as NominationStatsRow[];

  return mapNominationStatsRows(rows);
}
