import { randomUUID } from "node:crypto";
import { kv } from "@vercel/kv";
import { pickPrompts } from "./prompts";
import type {
  GamePhase,
  Player,
  RoomState,
  RoundState,
} from "@/types/game";

type GlobalRoomStore = typeof globalThis & {
  __partyRoomStore?: Map<string, RoomState>;
};

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_TTL_SECONDS = 60 * 60 * 6;
const DEFAULT_ROUNDS = 3;
const MAX_RESPONSE_LENGTH = 160;

const memoryStore = getMemoryStore();
const kvEnabled =
  Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN);

export class RoomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createRoom(hostName: string, rounds?: number) {
  const normalizedName = normalizeName(hostName);
  const hostId = randomUUID();
  const code = await generateRoomCode();
  const now = Date.now();

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
      },
    ],
    rounds: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveRoom(room);
  return { room, player: room.players[0] };
}

export async function joinRoom(code: string, playerName: string) {
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
  const prompts = pickPrompts(roundsToPlay);
  const now = Date.now();

  room.rounds = prompts.map((prompt) => ({
    id: randomUUID(),
    prompt,
    submissions: [],
    votes: [],
    status: "collecting",
    startedAt: now,
  }));
  room.roundsToPlay = roundsToPlay;
  room.currentRoundIndex = 0;
  room.phase = "prompt";
  room.updatedAt = now;

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
  const submission = {
    id: randomUUID(),
    playerId: player.id,
    text: body,
    voters: [],
    createdAt: Date.now(),
  };

  round.submissions.push(submission);
  player.lastActionAt = Date.now();
  room.updatedAt = Date.now();

  if (round.submissions.length === room.players.length) {
    round.status = "voting";
    room.phase = "vote";
  }

  await saveRoom(room);
  return room;
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
      if (!round || round.submissions.length < 2) {
        throw new RoomError("Need at least two answers before voting can start");
      }
      round.status = "voting";
      room.phase = "vote";
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
      }));
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

export async function getRoom(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  if (kvEnabled) {
    const payload = await kv.get<RoomState>(roomKey(normalizedCode));
    if (!payload) return null;
    return payload;
  }

  return memoryStore.get(normalizedCode) ?? null;
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

  for (const submission of round.submissions) {
    const votes = submission.voters.length;
    const author = room.players.find((player) => player.id === submission.playerId);
    if (author && votes > 0) {
      author.score += votes * 100;
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
