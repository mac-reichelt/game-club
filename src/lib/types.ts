export interface Member {
  id: number;
  name: string;
  avatar: string;
  joinedAt: string;
}

export interface Game {
  id: number;
  title: string;
  platform: string;
  description: string;
  imageUrl: string;
  nominatedBy: number;
  nominatedAt: string;
  status: "nominated" | "current" | "completed";
  scheduledDate: string | null;
  completedDate: string | null;
  avgRating: number | null;
}

export interface Vote {
  id: number;
  gameId: number;
  memberId: number;
  createdAt: string;
}

export interface Review {
  id: number;
  gameId: number;
  memberId: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export type GameWithNominator = Game & { nominatorName: string };
export type GameWithVotes = Game & { nominatorName: string; voteCount: number };
export type ReviewWithMember = Review & { memberName: string; memberAvatar: string };
