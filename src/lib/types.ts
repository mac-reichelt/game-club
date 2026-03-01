export interface Member {
  id: number;
  name: string;
  avatar: string;
  joined_at: string;
}

export interface Game {
  id: number;
  title: string;
  platform: string;
  description: string;
  image_url: string;
  nominated_by: number;
  nominated_at: string;
  status: "nominated" | "current" | "completed";
  scheduled_date: string | null;
  completed_date: string | null;
  avg_rating: number | null;
}

export interface Election {
  id: number;
  name: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  closes_at: string | null;
  winner_id: number | null;
}

export interface Ballot {
  id: number;
  election_id: number;
  member_id: number;
  game_id: number;
  rank: number;
  created_at: string;
}

export interface ElectionRound {
  id: number;
  election_id: number;
  round_number: number;
  eliminated_game_id: number | null;
  summary: string;
}

export interface Review {
  id: number;
  game_id: number;
  member_id: number;
  rating: number;
  comment: string;
  created_at: string;
}

export type GameWithNominator = Game & { nominatorName: string };
export type ReviewWithMember = Review & {
  memberName: string;
  memberAvatar: string;
};
export type ElectionWithWinner = Election & {
  winnerTitle: string | null;
  winnerPlatform: string | null;
  ballotCount: number;
};
export type ElectionRoundWithGame = ElectionRound & {
  eliminatedGameTitle: string | null;
};
