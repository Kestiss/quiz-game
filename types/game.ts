export type GamePhase = "lobby" | "prompt" | "vote" | "results" | "finished";

export interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
  lastActionAt: number;
  avatar: string;
}

export interface Submission {
  id: string;
  playerId: string;
  text: string;
  voters: string[];
  createdAt: number;
}

export interface Vote {
  playerId: string;
  submissionId: string;
  createdAt: number;
}

export interface RoundState {
  id: string;
  prompt: string;
  submissions: Submission[];
  votes: Vote[];
  status: "collecting" | "voting" | "closed";
  startedAt: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: GamePhase;
  roundsToPlay: number;
  currentRoundIndex: number;
  players: Player[];
  rounds: RoundState[];
  createdAt: number;
  updatedAt: number;
  theme: ThemeName;
  reactions: Record<ReactionEmoji, number>;
  stageMessage?: StageMessage | null;
}

export type PublicRoomState = RoomState;

export type ThemeName = "neon" | "gold" | "retro" | "spooky";
export type ReactionEmoji = "👏" | "😂" | "🔥" | "😮";

export interface StageMessage {
  id: string;
  kind: "teleprompter" | "intermission";
  text: string;
  expiresAt: number;
}
