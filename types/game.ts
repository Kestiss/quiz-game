export type GamePhase = "lobby" | "prompt" | "vote" | "results" | "finished";

export interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
  lastActionAt: number;
  avatar: string;
  streak: number;
  achievements: AchievementType[];
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
  deadline?: number;
  firstSubmitterId?: string;
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
  settings: GameSettings;
  customPrompts: string[];
}

export interface GameSettings {
  promptDuration: number; // seconds
  voteDuration: number; // seconds
  speedMode: boolean;
  autoAdvance: boolean;
  categories: PromptCategory[];
}

export type PromptCategory = "silly" | "popCulture" | "darkHumor" | "workplace" | "relationships" | "absurd";

export type PublicRoomState = RoomState;

export type ThemeName = "neon" | "gold" | "retro" | "spooky";
export type ReactionEmoji = "👏" | "😂" | "🔥" | "😮";

export type AchievementType =
  | "first-answer"
  | "crowd-favorite"
  | "underdog"
  | "streak-2"
  | "streak-3"
  | "unanimous";

export interface StageMessage {
  id: string;
  kind: "teleprompter" | "intermission";
  text: string;
  expiresAt: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  promptDuration: 60,
  voteDuration: 30,
  speedMode: false,
  autoAdvance: false,
  categories: [],
};
