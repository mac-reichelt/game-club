import type Database from "better-sqlite3";

interface TallyResult {
  rounds: {
    roundNumber: number;
    counts: Record<number, number>;
    eliminatedGameId: number | null;
    summary: string;
  }[];
  winnerId: number | null;
}

/**
 * Run ranked choice voting (instant-runoff) for an election.
 *
 * Algorithm:
 * 1. Count each voter's top-ranked remaining candidate
 * 2. If a candidate has >50% of votes, they win
 * 3. Otherwise, eliminate the candidate with the fewest first-choice votes
 * 4. Redistribute those ballots to voters' next choices
 * 5. Repeat until a winner emerges or candidates are exhausted
 */
export function tallyRankedChoice(
  db: Database.Database,
  electionId: number
): TallyResult {
  // Get all ballots for this election, ordered by member then rank
  const ballots = db
    .prepare(
      `SELECT member_id, game_id, rank
       FROM ballots
       WHERE election_id = ?
       ORDER BY member_id, rank`
    )
    .all(electionId) as { member_id: number; game_id: number; rank: number }[];

  // Build per-voter ranked lists
  const voterBallots = new Map<number, number[]>();
  for (const b of ballots) {
    if (!voterBallots.has(b.member_id)) {
      voterBallots.set(b.member_id, []);
    }
    voterBallots.get(b.member_id)!.push(b.game_id);
  }

  // Get all candidate game IDs in this election
  const candidates = new Set(
    (
      db
        .prepare(
          "SELECT game_id FROM election_games WHERE election_id = ?"
        )
        .all(electionId) as { game_id: number }[]
    ).map((r) => r.game_id)
  );

  const gameNames = new Map<number, string>();
  for (const gid of candidates) {
    const g = db
      .prepare("SELECT title FROM games WHERE id = ?")
      .get(gid) as { title: string } | undefined;
    if (g) gameNames.set(gid, g.title);
  }

  const eliminated = new Set<number>();
  const rounds: TallyResult["rounds"] = [];
  const totalVoters = voterBallots.size;

  if (totalVoters === 0) {
    return { rounds: [], winnerId: null };
  }

  for (let roundNum = 1; roundNum <= candidates.size; roundNum++) {
    // Count first-choice votes among remaining candidates
    const counts: Record<number, number> = {};
    for (const gid of candidates) {
      if (!eliminated.has(gid)) counts[gid] = 0;
    }

    for (const [, prefs] of voterBallots) {
      // Find this voter's top choice among remaining candidates
      for (const gid of prefs) {
        if (!eliminated.has(gid)) {
          counts[gid] = (counts[gid] || 0) + 1;
          break;
        }
      }
    }

    // Check for winner (majority)
    const remaining = Object.entries(counts);
    const maxVotes = Math.max(...remaining.map(([, v]) => v));
    const winner = remaining.find(([, v]) => v === maxVotes);

    // Only one candidate left?
    if (remaining.length === 1) {
      const winnerId = Number(remaining[0][0]);
      rounds.push({
        roundNumber: roundNum,
        counts,
        eliminatedGameId: null,
        summary: `${gameNames.get(winnerId) || winnerId} wins as the last remaining candidate with ${remaining[0][1]} vote(s).`,
      });
      return { rounds, winnerId };
    }

    // Has majority?
    if (winner && Number(winner[1]) > totalVoters / 2) {
      const winnerId = Number(winner[0]);
      rounds.push({
        roundNumber: roundNum,
        counts,
        eliminatedGameId: null,
        summary: `${gameNames.get(winnerId) || winnerId} wins with ${winner[1]}/${totalVoters} votes (majority).`,
      });
      return { rounds, winnerId };
    }

    // Find candidate with fewest votes to eliminate
    const minVotes = Math.min(...remaining.map(([, v]) => v));
    const toEliminate = remaining.filter(([, v]) => v === minVotes);
    // Tie-break: eliminate the one nominated most recently (highest ID)
    const eliminateId = Math.max(...toEliminate.map(([k]) => Number(k)));

    eliminated.add(eliminateId);

    const summaryParts = remaining
      .sort(([, a], [, b]) => b - a)
      .map(([gid, v]) => `${gameNames.get(Number(gid)) || gid}: ${v}`)
      .join(", ");

    rounds.push({
      roundNumber: roundNum,
      counts,
      eliminatedGameId: eliminateId,
      summary: `Round ${roundNum}: ${summaryParts}. Eliminated: ${gameNames.get(eliminateId) || eliminateId}.`,
    });
  }

  return { rounds, winnerId: null };
}
