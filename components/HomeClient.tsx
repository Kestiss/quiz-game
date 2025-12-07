"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";
import type { PublicRoomState, RoundState } from "@/types/game";

type Session =
  | null
  | {
      roomCode: string;
      playerId: string;
      playerName: string;
      isHost: boolean;
    };

const STORAGE_KEY = "party-quips-session";

const fetcher = async (url: string): Promise<PublicRoomState> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load room");
  }
  return payload.room as PublicRoomState;
};

interface ActionOptions {
  path: string;
  payload: Record<string, unknown>;
  mutate?: () => void;
}

async function postAction({ path, payload, mutate }: ActionOptions) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Action failed");
  }
  mutate?.();
  return data;
}

export function HomeClient() {
  const [session, setSession] = useState<Session>(null);
  const [pendingMessage, setPendingMessage] = useState("");
  const [responseDraft, setResponseDraft] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", rounds: 3 });
  const [joinForm, setJoinForm] = useState({ name: "", code: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const hydrateSession = useEffectEvent((value: Session | null) => {
    setSession(value);
  });
  const clearMessage = useEffectEvent(() => setPendingMessage(""));
  const expireSession = useEffectEvent(() => {
    setSession(null);
    setPendingMessage("Room expired. Create or join a new one.");
  });
  const resetDraft = useEffectEvent(() => setResponseDraft(""));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        hydrateSession(JSON.parse(saved) as Session);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const { data: room, error, mutate } = useSWR(
    session ? `/api/rooms/${session.roomCode}` : null,
    fetcher,
    { refreshInterval: 2000 },
  );

  useEffect(() => {
    if (room) {
      clearMessage();
    }
  }, [room]);

  useEffect(() => {
    if (error?.message.includes("not found") && session) {
      expireSession();
    }
  }, [error, session]);

  const currentRound = room?.currentRoundIndex != null &&
    room.currentRoundIndex >= 0 &&
    room.rounds[room.currentRoundIndex]
      ? (room.rounds[room.currentRoundIndex] as RoundState)
      : undefined;

  useEffect(() => {
    resetDraft();
  }, [room?.currentRoundIndex]);

  const answeredIds = useMemo(() => {
    if (!currentRound) return new Set<string>();
    return new Set(currentRound.submissions.map((item) => item.playerId));
  }, [currentRound]);

  const votedIds = useMemo(() => {
    if (!currentRound) return new Set<string>();
    return new Set(currentRound.votes.map((item) => item.playerId));
  }, [currentRound]);

  const handleCreateRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      const payload = await postAction({
        path: "/api/rooms",
        payload: { name: createForm.name, rounds: createForm.rounds },
      });
      setSession({
        roomCode: payload.room.code,
        playerId: payload.player.id,
        playerName: payload.player.name,
        isHost: true,
      });
      setCreateForm({ name: "", rounds: createForm.rounds });
      setPendingMessage("");
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  const handleJoinRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      const code = joinForm.code.trim().toUpperCase();
      const payload = await postAction({
        path: `/api/rooms/${code}/join`,
        payload: { name: joinForm.name },
      });
      setSession({
        roomCode: payload.room.code,
        playerId: payload.player.id,
        playerName: payload.player.name,
        isHost: payload.room.hostId === payload.player.id,
      });
      setPendingMessage("");
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to join room");
    }
  };

  const handleLeave = () => {
    setSession(null);
    setResponseDraft("");
    setPendingMessage("You left the room.");
  };

  const submitResponseAction = useCallback(async () => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/submit`,
        payload: { playerId: session.playerId, text: responseDraft },
        mutate,
      });
      setResponseDraft("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to submit answer");
    }
  }, [room, session, responseDraft, mutate]);

  const submitVoteAction = async (submissionId: string) => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/vote`,
        payload: { playerId: session.playerId, submissionId },
        mutate,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to submit vote");
    }
  };

  const startGame = async () => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/start`,
        payload: {
          playerId: session.playerId,
          rounds: room.roundsToPlay,
        },
        mutate,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to start game");
    }
  };

  const advancePhaseAction = async () => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/advance`,
        payload: { playerId: session.playerId },
        mutate,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to advance");
    }
  };

  const hasSubmitted = session && currentRound
    ? answeredIds.has(session.playerId)
    : false;
  const hasVoted = session && currentRound ? votedIds.has(session.playerId) : false;

  return (
    <div className="container">
      <header className="hero">
        <h1>Party Prompts</h1>
        <p>Fast, lightweight Quiplash-style rounds you can host on Vercel.</p>
      </header>

      {pendingMessage && <p className="info">{pendingMessage}</p>}
      {formError && <p className="error">{formError}</p>}

      {!session && (
        <div className="grid">
          <section className="card">
            <h2>Create a room</h2>
            <form onSubmit={handleCreateRoom} className="form">
              <label>
                Host name
                <input
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Captain Chuckles"
                  required
                />
              </label>
              <label>
                Rounds (1-5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={createForm.rounds}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      rounds: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button type="submit">Generate code</button>
            </form>
          </section>

          <section className="card">
            <h2>Join a room</h2>
            <form onSubmit={handleJoinRoom} className="form">
              <label>
                Name
                <input
                  value={joinForm.name}
                  onChange={(event) =>
                    setJoinForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Sassy Panda"
                  required
                />
              </label>
              <label>
                Room code
                <input
                  value={joinForm.code}
                  onChange={(event) =>
                    setJoinForm((prev) => ({ ...prev, code: event.target.value }))
                  }
                  placeholder="ABCD"
                  required
                  maxLength={4}
                  style={{ textTransform: "uppercase" }}
                />
              </label>
              <button type="submit">Join lobby</button>
            </form>
          </section>
        </div>
      )}

      {session && (
        <section className="card heavy">
          <div className="session-bar">
            <div>
              <p className="eyebrow">Room code</p>
              <p className="code">{session.roomCode}</p>
            </div>
            <div>
              <p className="eyebrow">You are</p>
              <p>{session.playerName}</p>
              {session.isHost && <span className="tag">Host</span>}
            </div>
            <button onClick={handleLeave} className="secondary">
              Leave room
            </button>
          </div>

          {!room && !error && <p>Loading room...</p>}

          {room && (
            <>
              <GamePhaseView
                room={room}
                session={session}
                currentRound={currentRound}
                hasSubmitted={hasSubmitted}
                hasVoted={hasVoted}
                responseDraft={responseDraft}
                setResponseDraft={setResponseDraft}
                onSubmitResponse={submitResponseAction}
                onSubmitVote={submitVoteAction}
                onStartGame={startGame}
                onAdvance={advancePhaseAction}
              />
              <Scoreboard room={room} answeredIds={answeredIds} votedIds={votedIds} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

interface GamePhaseProps {
  room: PublicRoomState;
  session: NonNullable<Session>;
  currentRound?: RoundState;
  hasSubmitted: boolean;
  hasVoted: boolean;
  responseDraft: string;
  setResponseDraft: (value: string) => void;
  onSubmitResponse: () => Promise<void>;
  onSubmitVote: (submissionId: string) => Promise<void>;
  onStartGame: () => Promise<void>;
  onAdvance: () => Promise<void>;
}

function GamePhaseView({
  room,
  session,
  currentRound,
  hasSubmitted,
  hasVoted,
  responseDraft,
  setResponseDraft,
  onSubmitResponse,
  onSubmitVote,
  onStartGame,
  onAdvance,
}: GamePhaseProps) {
  switch (room.phase) {
    case "lobby":
      return (
        <div className="phase">
          <h2>Lobby</h2>
          <p>Share the code so your friends can join.</p>
          {session.isHost && (
            <button
              onClick={onStartGame}
              disabled={room.players.length < 3}
              className="primary"
            >
              Start game
            </button>
          )}
          {!session.isHost && <p>Waiting for the host to start...</p>}
        </div>
      );
    case "prompt":
      return (
        <div className="phase">
          <h2>Prompt #{(room.currentRoundIndex ?? 0) + 1}</h2>
          <p className="prompt">{currentRound?.prompt}</p>
          <p>
            Answers received: {currentRound?.submissions.length ?? 0} /{" "}
            {room.players.length}
          </p>
          {hasSubmitted ? (
            <p className="info">Answer locked in! Waiting on the others.</p>
          ) : (
            <div className="response-form">
              <textarea
                value={responseDraft}
                onChange={(event) => setResponseDraft(event.target.value)}
                placeholder="Drop your funniest response..."
                maxLength={160}
              />
              <button
                onClick={onSubmitResponse}
                disabled={responseDraft.trim().length < 2}
                className="primary"
              >
                Submit answer
              </button>
            </div>
          )}
          {session.isHost && (
            <button
              onClick={onAdvance}
              className="secondary"
              disabled={(currentRound?.submissions.length ?? 0) < 2}
            >
              Move to voting
            </button>
          )}
        </div>
      );
    case "vote":
      return (
        <div className="phase">
          <h2>Vote for the best reply</h2>
          {currentRound?.submissions.length === 0 && (
            <p>No submissions yet. Host can skip ahead.</p>
          )}
          <div className="submission-list">
            {currentRound?.submissions.map((submission) => {
              const isSelf = submission.playerId === session.playerId;
              return (
                <button
                  key={submission.id}
                  onClick={() => onSubmitVote(submission.id)}
                  disabled={hasVoted || isSelf}
                  className="submission"
                >
                  <p>{submission.text}</p>
                  {isSelf && <span className="tag">Yours</span>}
                </button>
              );
            })}
          </div>
          {hasVoted ? (
            <p className="info">Vote received!</p>
          ) : (
            <p>Tap your favorite answer. You cannot vote for yourself.</p>
          )}
          {session.isHost && (
            <button onClick={onAdvance} className="secondary">
              Reveal results
            </button>
          )}
        </div>
      );
    case "results":
      return (
        <div className="phase">
          <h2>Round results</h2>
          <p className="prompt">{currentRound?.prompt}</p>
          <div className="submission-list">
            {currentRound?.submissions.map((submission) => {
              const votes = submission.voters.length;
              const author = room.players.find(
                (player) => player.id === submission.playerId,
              );
              return (
                <div key={submission.id} className="result">
                  <p>{submission.text}</p>
                  <p className="muted">
                    {author?.name ?? "Unknown"} · {votes} vote
                    {votes === 1 ? "" : "s"}
                  </p>
                </div>
              );
            })}
          </div>
          {session.isHost && (
            <button onClick={onAdvance} className="primary">
              {room.currentRoundIndex + 1 >= room.rounds.length
                ? "Show final scores"
                : "Next round"}
            </button>
          )}
        </div>
      );
    case "finished":
      return (
        <div className="phase">
          <h2>Final scoreboard</h2>
          <ol className="winners">
            {[...room.players]
              .sort((a, b) => b.score - a.score)
              .map((player) => (
                <li key={player.id}>
                  <span>{player.name}</span>
                  <span>{player.score} pts</span>
                </li>
              ))}
          </ol>
          {session.isHost && (
            <button onClick={onAdvance} className="secondary">
              Reset lobby
            </button>
          )}
        </div>
      );
    default:
      return null;
  }
}

function Scoreboard({
  room,
  answeredIds,
  votedIds,
}: {
  room: PublicRoomState;
  answeredIds: Set<string>;
  votedIds: Set<string>;
}) {
  const players = useMemo(
    () => [...room.players].sort((a, b) => b.score - a.score),
    [room.players],
  );

  return (
    <div className="scoreboard">
      <h3>Players</h3>
      <ul>
        {players.map((player) => (
          <li key={player.id}>
            <div>
              <strong>{player.name}</strong>
              {room.hostId === player.id && <span className="tag">Host</span>}
            </div>
            <div className="status-row">
              <span>{player.score} pts</span>
              {room.phase === "prompt" && answeredIds.has(player.id) && (
                <span className="tag subtle">Answered</span>
              )}
              {room.phase === "vote" && votedIds.has(player.id) && (
                <span className="tag subtle">Voted</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
