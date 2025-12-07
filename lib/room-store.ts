import { randomUUID } from "node:crypto";
import { kv } from "@vercel/kv";
import { pickPrompts, pickPromptsWithCustom, getRandomSafetyQuip } from "./prompts";
import type {
  AchievementType,
  GamePhase,
  GameSettings,
  Player,
  PromptCategory,
  ReactionEmoji,
  RoomState,
  RoundState,
  StageMessage,
  ThemeName,
  DEFAULT_SETTINGS,
} from "@/types/game";

type GlobalRoomStore = typeof globalThis & {
  __partyRoomStore?: Map<string, RoomState>;
};

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_TTL_SECONDS = 60 * 60 * 6;
const DEFAULT_ROUNDS = 3;
const MAX_RESPONSE_LENGTH = 160;
const DEFAULT_THEME: ThemeName = "neon";
const DEFAULT_REACTIONS: Record<ReactionEmoji, number> = {
  "👏": 0,
  "😂": 0,
  "🔥": 0,
  "😮": 0,
};
const AVATAR_CHOICES = ["🎤", "🎭", "🤖", "🦄", "🛸", "🐙", "🧠", "🔥", "🎲", "🥳"];

const DEFAULT_GAME_SETTINGS: GameSettings = {
  promptDuration: 60,
  voteDuration: 30,
  speedMode: false,
  autoAdvance: false,
  categories: [],
};

const memoryStore = getMemoryStore();
const kvEnabled =
  Boolean(process.env.KV_REST_API_URL) ||
  Boolean(process.env.KV_REST_API_TOKEN) ||
  Boolean(process.env.REDIS_URL);

export class RoomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createRoom(hostName: string, rounds?: number, avatar?: string) {
  const normalizedName = normalizeName(hostName);
  const hostId = randomUUID();
  const code = await generateRoomCode();
  const now = Date.now();
  const hostAvatar = pickAvatar(avatar);

  const room: RoomState = {
    code,
    hostId,
    phase: "lobby",
    roundsToPlay: clampRounds(rounds),
    currentRoundIndex: -1,
    players: [
      {
        id: hostId,
        name: normalizedName,
        score: 0,
        joinedAt: now,
        lastActionAt: now,
        avatar: hostAvatar,
        streak: 0,
        achievements: [],
      },
    ],
    rounds: [],
    createdAt: now,
    updatedAt: now,
    theme: DEFAULT_THEME,
    reactions: { ...DEFAULT_REACTIONS },
    stageMessage: null,
    settings: { ...DEFAULT_GAME_SETTINGS },
    customPrompts: [],
  };

  await saveRoom(room);
  return { room, player: room.players[0] };
}

export async function joinRoom(code: string, playerName: string, avatar?: string) {
  const normalizedCode = code.trim().toUpperCase();
  const room = requireRoom(await getRoom(normalizedCode), normalizedCode);
  if (room.phase !== "lobby") {
    throw new RoomError("The game already started", 409);
  }

  const normalizedName = normalizeName(playerName);
  if (room.players.some((player) => player.name === normalizedName)) {
    throw new RoomError("That name is already taken in this room");
  }

  const now = Date.now();
  const player: Player = {
    id: randomUUID(),
    name: normalizedName,
    score: 0,
    joinedAt: now,
    lastActionAt: now,
    avatar: pickAvatar(avatar),
    streak: 0,
    achievements: [],
  };

  room.players.push(player);
  room.updatedAt = now;

  await saveRoom(room);
  return { room, player };
}

export async function startGame(
  code: string,
  hostId: string,
  rounds?: number,
) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, hostId);

  if (room.players.length < 3) {
    throw new RoomError("You need at least 3 players to start", 422);
  }

  const roundsToPlay = clampRounds(rounds ?? room.roundsToPlay);
  const prompts = room.customPrompts.length > 0
    ? pickPromptsWithCustom(roundsToPlay, room.customPrompts, room.settings.categories as PromptCategory[])
    : pickPrompts(roundsToPlay, room.settings.categories as PromptCategory[]);
  const now = Date.now();
  const duration = room.settings.speedMode ? 30 : room.settings.promptDuration;

  room.rounds = prompts.map((prompt) => ({
    id: randomUUID(),
    prompt,
    submissions: [],
    votes: [],
    status: "collecting",
    startedAt: now,
    deadline: now + duration * 1000,
  }));
  room.roundsToPlay = roundsToPlay;
  room.currentRoundIndex = 0;
  room.phase = "prompt";
  room.updatedAt = now;

  // Reset player streaks and achievements for new game
  room.players = room.players.map((player) => ({
    ...player,
    score: 0,
    streak: 0,
    achievements: [],
  }));

  await saveRoom(room);
  return room;
}

export async function submitResponse(
  code: string,
  playerId: string,
  text: string,
) {
  const room = requireRoom(await getRoom(code), code);
  const player = requirePlayer(room, playerId);
  requirePhase(room, "prompt");

  const round = currentRound(room);
  if (!round) {
    throw new RoomError("No active round", 409);
  }

  if (round.submissions.some((submission) => submission.playerId === player.id)) {
    throw new RoomError("You already submitted an answer");
  }

  const body = sanitizeResponse(text);
  const now = Date.now();

  // Check if first to submit
  const isFirst = round.submissions.length === 0;
  if (isFirst) {
    round.firstSubmitterId = player.id;
    if (!player.achievements.includes("first-answer")) {
      player.achievements.push("first-answer");
    }
  }

  const submission = {
    id: randomUUID(),
    playerId: player.id,
    text: body,
    voters: [],
    createdAt: now,
  };

  round.submissions.push(submission);
  player.lastActionAt = now;
  room.updatedAt = now;

  if (round.submissions.length === room.players.length) {
    transitionToVoting(room, round);
  }

  await saveRoom(room);
  return room;
}

function transitionToVoting(room: RoomState, round: RoundState) {
  round.status = "voting";
  room.phase = "vote";
  const voteDuration = room.settings.speedMode ? 20 : room.settings.voteDuration;
  round.deadline = Date.now() + voteDuration * 1000;
}

export async function submitVote(
  code: string,
  playerId: string,
  submissionId: string,
) {
  const room = requireRoom(await getRoom(code), code);
  const player = requirePlayer(room, playerId);
  requirePhase(room, "vote");

  const round = currentRound(room);
  if (!round) {
    throw new RoomError("No active round", 409);
  }

  if (round.votes.some((vote) => vote.playerId === player.id)) {
    throw new RoomError("You already voted");
  }

  const submission = round.submissions.find((item) => item.id === submissionId);
  if (!submission) {
    throw new RoomError("Submission not found", 404);
  }

  if (submission.playerId === player.id) {
    throw new RoomError("You cannot vote for yourself");
  }

  const vote = { playerId: player.id, submissionId, createdAt: Date.now() };
  round.votes.push(vote);
  submission.voters.push(player.id);
  player.lastActionAt = Date.now();
  room.updatedAt = Date.now();

  if (round.votes.length >= Math.max(2, room.players.length - 1)) {
    finalizeRound(room);
  }

  await saveRoom(room);
  return room;
}

export async function advancePhase(code: string, playerId: string) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, playerId);

  switch (room.phase) {
    case "prompt": {
      const round = currentRound(room);
      if (!round) {
        throw new RoomError("No active round", 409);
      }

      // Add safety quips for non-submitters
      const submitterIds = new Set(round.submissions.map((s) => s.playerId));
      room.players.forEach((player) => {
        if (!submitterIds.has(player.id)) {
          round.submissions.push({
            id: randomUUID(),
            playerId: player.id,
            text: getRandomSafetyQuip(),
            voters: [],
            createdAt: Date.now(),
          });
        }
      });

      if (round.submissions.length < 2) {
        throw new RoomError("Need at least two answers before voting can start");
      }
      transitionToVoting(room, round);
      break;
    }
    case "vote": {
      finalizeRound(room);
      break;
    }
    case "results": {
      if (room.currentRoundIndex + 1 < room.rounds.length) {
        room.currentRoundIndex += 1;
        const nextRound = currentRound(room);
        if (nextRound) {
          nextRound.status = "collecting";
          room.phase = "prompt";
          const duration = room.settings.speedMode ? 30 : room.settings.promptDuration;
          nextRound.deadline = Date.now() + duration * 1000;
        }
      } else {
        room.phase = "finished";
      }
      break;
    }
    case "finished": {
      room.phase = "lobby";
      room.currentRoundIndex = -1;
      room.rounds = [];
      room.players = room.players.map((player) => ({
        ...player,
        score: 0,
        streak: 0,
        achievements: [],
      }));
      room.reactions = { ...DEFAULT_REACTIONS };
      break;
    }
    case "lobby":
    default:
      throw new RoomError("There is nothing to advance right now");
  }

  room.updatedAt = Date.now();
  await saveRoom(room);
  return room;
}

export async function updateSettings(
  code: string,
  playerId: string,
  settings: Partial<GameSettings>
) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, playerId);

  if (room.phase !== "lobby") {
    throw new RoomError("Settings can only be changed in the lobby");
  }

  room.settings = { ...room.settings, ...settings };

  // Speed mode overrides durations
  if (settings.speedMode) {
    room.settings.promptDuration = 30;
    room.settings.voteDuration = 20;
  }

  room.updatedAt = Date.now();
  await saveRoom(room);
  return room;
}

export async function addCustomPrompt(code: string, playerId: string, prompt: string) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, playerId);

  if (room.phase !== "lobby") {
    throw new RoomError("Custom prompts can only be added in the lobby");
  }

  const sanitized = prompt.trim();
  if (sanitized.length < 5) {
    throw new RoomError("Prompt too short");
  }
  if (sanitized.length > 150) {
    throw new RoomError("Prompt too long");
  }

  room.customPrompts.push(sanitized);
  room.updatedAt = Date.now();
  await saveRoom(room);
  return room;
}

export async function clearCustomPrompts(code: string, playerId: string) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, playerId);

  room.customPrompts = [];
  room.updatedAt = Date.now();
  await saveRoom(room);
  return room;
}

export async function setTheme(code: string, playerId: string, theme: ThemeName) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, playerId);
  room.theme = validateTheme(theme);
  room.updatedAt = Date.now();
  await saveRoom(room);
  return room;
}

export async function submitReaction(code: string, reaction: ReactionEmoji) {
  const room = requireRoom(await getRoom(code), code);
  if (!(reaction in room.reactions)) {
    throw new RoomError("Unknown reaction", 400);
  }
  room.reactions[reaction] += 1;
  room.updatedAt = Date.now();
  await saveRoom(room);
  return room.reactions;
}

export async function sendStageMessage(
  code: string,
  playerId: string,
  message: Omit<StageMessage, "id" | "expiresAt"> & { durationMs?: number },
) {
  const room = requireRoom(await getRoom(code), code);
  ensureHost(room, playerId);
  const duration = message.durationMs ?? 10000;
  room.stageMessage = {
    id: randomUUID(),
    kind: message.kind,
    text: sanitizeResponse(message.text),
    expiresAt: Date.now() + duration,
  };
  room.updatedAt = Date.now();
  await saveRoom(room);
  return room.stageMessage;
}

export async function getRoom(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  if (kvEnabled) {
    const payload = await kv.get<RoomState>(roomKey(normalizedCode));
    if (!payload) return null;
    return migrateRoom(pruneStageMessage(payload));
  }

  const room = memoryStore.get(normalizedCode) ?? null;
  return room ? migrateRoom(pruneStageMessage(room)) : null;
}

// Migrate old room format to new format
function migrateRoom(room: RoomState): RoomState {
  // Add settings if missing
  if (!room.settings) {
    room.settings = { ...DEFAULT_GAME_SETTINGS };
  }
  // Add customPrompts if missing
  if (!room.customPrompts) {
    room.customPrompts = [];
  }
  // Add player fields if missing
  room.players = room.players.map((player) => ({
    ...player,
    streak: player.streak ?? 0,
    achievements: player.achievements ?? [],
  }));
  return room;
}

async function saveRoom(room: RoomState) {
  if (kvEnabled) {
    await kv.set(roomKey(room.code), room, { ex: ROOM_TTL_SECONDS });
    return;
  }

  memoryStore.set(room.code, room);
}

function roomKey(code: string) {
  return `room:${code}`;
}

function clampRounds(rounds?: number) {
  if (typeof rounds !== "number" || Number.isNaN(rounds)) {
    return DEFAULT_ROUNDS;
  }
  return Math.min(5, Math.max(1, Math.floor(rounds)));
}

function normalizeName(input: string) {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    throw new RoomError("Name must be at least 2 characters long");
  }
  if (trimmed.length > 18) {
    throw new RoomError("Name must be shorter than 18 characters");
  }
  return trimmed;
}

function sanitizeResponse(input: string) {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    throw new RoomError("Response is too short");
  }
  if (trimmed.length > MAX_RESPONSE_LENGTH) {
    return trimmed.slice(0, MAX_RESPONSE_LENGTH);
  }
  return trimmed;
}

function validateTheme(theme: ThemeName) {
  const allowed: ThemeName[] = ["neon", "gold", "retro", "spooky"];
  return allowed.includes(theme) ? theme : DEFAULT_THEME;
}

function pruneStageMessage(room: RoomState) {
  if (room.stageMessage && room.stageMessage.expiresAt < Date.now()) {
    room.stageMessage = null;
  }
  return room;
}

function pickAvatar(preferred?: string) {
  if (preferred && preferred.length <= 3) {
    return preferred;
  }
  const index = Math.floor(Math.random() * AVATAR_CHOICES.length);
  return AVATAR_CHOICES[index];
}

function requireRoom(room: RoomState | null, code: string): RoomState {
  if (!room) {
    throw new RoomError(`Room ${code} not found`, 404);
  }
  return room;
}

function requirePlayer(room: RoomState, playerId: string) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) {
    throw new RoomError("Player not found", 404);
  }
  return player;
}

function ensureHost(room: RoomState, playerId: string) {
  if (room.hostId !== playerId) {
    throw new RoomError("Only the host can do that", 403);
  }
}

function requirePhase(room: RoomState, phase: GamePhase) {
  if (room.phase !== phase) {
    throw new RoomError(`Room is not in the ${phase} phase`, 409);
  }
}

function currentRound(room: RoomState): RoundState | undefined {
  if (room.currentRoundIndex < 0) return undefined;
  return room.rounds[room.currentRoundIndex];
}

function finalizeRound(room: RoomState) {
  const round = currentRound(room);
  if (!round) {
    throw new RoomError("No active round", 409);
  }

  round.status = "closed";
  room.phase = "results";

  // Find winner and update scores/streaks
  let maxVotes = 0;
  let winnerId: string | null = null;

  for (const submission of round.submissions) {
    const votes = submission.voters.length;
    const author = room.players.find((player) => player.id === submission.playerId);
    if (author && votes > 0) {
      author.score += votes * 100;
      if (votes > maxVotes) {
        maxVotes = votes;
        winnerId = author.id;
      }
    }
  }

  // Update streaks and achievements
  room.players.forEach((player) => {
    if (player.id === winnerId) {
      player.streak += 1;

      // Award streak achievements
      if (player.streak >= 3 && !player.achievements.includes("streak-3")) {
        player.achievements.push("streak-3");
      } else if (player.streak >= 2 && !player.achievements.includes("streak-2")) {
        player.achievements.push("streak-2");
      }

      // Check for crowd favorite (most total votes across game)
      if (!player.achievements.includes("crowd-favorite")) {
        player.achievements.push("crowd-favorite");
      }

      // Check for unanimous (everyone voted for them)
      const winningSubmission = round.submissions.find((s) => s.playerId === winnerId);
      if (winningSubmission && winningSubmission.voters.length >= room.players.length - 1) {
        if (!player.achievements.includes("unanimous")) {
          player.achievements.push("unanimous");
        }
      }
    } else {
      // Reset streak for non-winners
      player.streak = 0;
    }
  });

  // Check for underdog (person in last place wins)
  if (winnerId) {
    const sorted = [...room.players].sort((a, b) => a.score - b.score);
    const lastPlace = sorted[0];
    if (lastPlace.id === winnerId && room.players.length > 2) {
      const winner = room.players.find((p) => p.id === winnerId);
      if (winner && !winner.achievements.includes("underdog")) {
        winner.achievements.push("underdog");
      }
    }
  }
}

async function generateRoomCode() {
  let attempts = 0;
  while (attempts < 50) {
    const code = Array.from({ length: 4 }, () => {
      const index = Math.floor(Math.random() * CODE_CHARS.length);
      return CODE_CHARS[index];
    }).join("");
    const existing = await getRoom(code);
    if (!existing) return code;
    attempts += 1;
  }
  throw new RoomError("Failed to generate a room code, try again", 500);
}

function getMemoryStore() {
  const globalWithStore = globalThis as GlobalRoomStore;
  if (!globalWithStore.__partyRoomStore) {
    globalWithStore.__partyRoomStore = new Map<string, RoomState>();
  }
  return globalWithStore.__partyRoomStore;
}
