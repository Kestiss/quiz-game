"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import type {
  GamePhase,
  PublicRoomState,
  ReactionEmoji,
  RoundState,
  ThemeName,
  PromptCategory,
  AchievementType,
} from "@/types/game";
import { useSoundBoard } from "@/hooks/useSoundBoard";
import { useSpeech } from "@/hooks/useSpeech";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { TimerBar } from "./CountdownTimer";
import { AchievementContainer } from "./AchievementToast";
import { ResultsCard } from "./ResultsCard";
import { PROMPT_CATEGORIES } from "@/lib/prompts";

type Session =
  | null
  | {
    roomCode: string;
    playerId: string;
    playerName: string;
    isHost: boolean;
  };

interface Achievement {
  id: string;
  type: AchievementType;
  playerName: string;
}

const STORAGE_KEY = "party-quips-session";
const SOUND_KEY = "party-quips-sound";
const VOICE_KEY = "party-quips-voice";
const REACTIONS: ReactionEmoji[] = ["👏", "😂", "🔥", "😮"];
const THEMES: ThemeName[] = ["neon", "gold", "retro", "spooky"];
const AVATARS = ["🎤", "🎭", "🤖", "🦄", "🛸", "🐙", "🧠", "🔥", "🎲", "🥳"];

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
  const [createForm, setCreateForm] = useState({
    name: "",
    rounds: 3,
    avatar: "🎤",
  });
  const [joinForm, setJoinForm] = useState({ name: "", code: "", avatar: "🎤" });
  const [formError, setFormError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [intermissionSeconds, setIntermissionSeconds] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [customPromptInput, setCustomPromptInput] = useState("");
  const prevAchievementsRef = useRef<Map<string, AchievementType[]>>(new Map());

  const hydrateSession = useEffectEvent((value: Session | null) => {
    setSession(value);
  });
  const clearMessage = useEffectEvent(() => setPendingMessage(""));
  const expireSession = useEffectEvent(() => {
    setSession(null);
    setPendingMessage("Room expired. Create or join a new one.");
  });
  const resetDraft = useEffectEvent(() => setResponseDraft(""));
  const applySoundSetting = useEffectEvent((value: boolean) => {
    setSoundEnabled(value);
  });
  const applyVoiceSetting = useEffectEvent((value: boolean) => {
    setVoiceEnabled(value);
  });

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
    const saved = window.localStorage.getItem(SOUND_KEY);
    if (saved) {
      applySoundSetting(saved !== "off");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VOICE_KEY);
    if (saved) {
      applyVoiceSetting(saved !== "off");
    }
  }, []);

  // Read room code from URL query parameter (?code=XXXX)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");
    if (codeFromUrl && !session) {
      setJoinForm((prev) => ({ ...prev, code: codeFromUrl.toUpperCase() }));
      // Clean up URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VOICE_KEY, voiceEnabled ? "on" : "off");
  }, [voiceEnabled]);

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

  // Track achievements
  useEffect(() => {
    if (!room) return;

    room.players.forEach((player) => {
      const prev = prevAchievementsRef.current.get(player.id) || [];
      const newAchievements = player.achievements.filter((a) => !prev.includes(a));

      newAchievements.forEach((type) => {
        setAchievements((a) => [
          ...a,
          { id: `${Date.now()}-${type}`, type, playerName: player.name },
        ]);
      });

      prevAchievementsRef.current.set(player.id, player.achievements);
    });
  }, [room?.players]);

  const dismissAchievement = useCallback((id: string) => {
    setAchievements((a) => a.filter((item) => item.id !== id));
  }, []);

  const answeredIds = useMemo(() => {
    if (!currentRound) return new Set<string>();
    return new Set(currentRound.submissions.map((item) => item.playerId));
  }, [currentRound]);

  const votedIds = useMemo(() => {
    if (!currentRound) return new Set<string>();
    return new Set(currentRound.votes.map((item) => item.playerId));
  }, [currentRound]);

  const {
    playJoin,
    playSubmit,
    playVote,
    playAdvance,
    playFanfare,
    playBuzzer,
    playApplause,
    playLaugh,
    playSting,
    playDrumroll,
    playWhoosh,
    playPop,
    playCheer,
    playTick,
    playUrgent,
    playReveal,
  } = useSoundBoard(soundEnabled);
  const { speak: speakPrompt, supported: speechSupported, cancel: cancelSpeech } =
    useSpeech(voiceEnabled);
  const bgm = useBackgroundMusic();

  const lastPhaseRef = useRef<GamePhase | null>(null);
  useEffect(() => {
    if (!room) return;
    if (lastPhaseRef.current && lastPhaseRef.current !== room.phase) {
      playAdvance();
      if (room.phase === "results") {
        playApplause();
      } else if (room.phase === "finished") {
        playFanfare();
      } else if (room.phase === "vote") {
        playSting();
      }
    }
    lastPhaseRef.current = room.phase;
  }, [room?.phase, room, playAdvance, playApplause, playFanfare, playSting]);

  const lastPlayerCountRef = useRef(0);
  useEffect(() => {
    if (!room) return;
    if (
      lastPlayerCountRef.current > 0 &&
      room.players.length > lastPlayerCountRef.current
    ) {
      playJoin();
    }
    lastPlayerCountRef.current = room.players.length;
  }, [room?.players.length, room, playJoin]);

  const lastSpokenPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !room ||
      room.phase !== "prompt" ||
      !currentRound?.prompt ||
      !voiceEnabled ||
      !speechSupported
    ) {
      return;
    }
    if (lastSpokenPromptRef.current === currentRound.prompt) return;
    speakPrompt(currentRound.prompt);
    lastSpokenPromptRef.current = currentRound.prompt;
  }, [
    room?.phase,
    currentRound?.prompt,
    voiceEnabled,
    speechSupported,
    speakPrompt,
    room,
  ]);

  useEffect(() => () => cancelSpeech(), [cancelSpeech]);

  useEffect(() => {
    if (room?.phase !== "prompt") {
      lastSpokenPromptRef.current = null;
    }
  }, [room?.phase]);

  const handleCreateRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      const payload = await postAction({
        path: "/api/rooms",
        payload: {
          name: createForm.name,
          rounds: createForm.rounds,
          avatar: createForm.avatar,
        },
      });
      setSession({
        roomCode: payload.room.code,
        playerId: payload.player.id,
        playerName: payload.player.name,
        isHost: true,
      });
      setCreateForm((prev) => ({ ...prev, name: "" }));
      setPendingMessage("");
      mutate();
      playJoin();
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
        payload: { name: joinForm.name, avatar: joinForm.avatar },
      });
      setSession({
        roomCode: payload.room.code,
        playerId: payload.player.id,
        playerName: payload.player.name,
        isHost: payload.room.hostId === payload.player.id,
      });
      setPendingMessage("");
      mutate();
      playJoin();
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
      playSubmit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to submit answer");
    }
  }, [room, session, responseDraft, mutate, playSubmit]);

  const submitVoteAction = async (submissionId: string) => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/vote`,
        payload: { playerId: session.playerId, submissionId },
        mutate,
      });
      playVote();
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
      playAdvance();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to advance");
    }
  };

  const updateTheme = async (theme: ThemeName) => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/theme`,
        payload: { playerId: session.playerId, theme },
        mutate,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to change theme");
    }
  };

  const updateSettings = async (settings: Record<string, unknown>) => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/settings`,
        payload: { playerId: session.playerId, settings },
        mutate,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to update settings");
    }
  };

  const addCustomPrompt = async () => {
    if (!session || !room || !customPromptInput.trim()) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/prompts`,
        payload: { playerId: session.playerId, prompt: customPromptInput },
        mutate,
      });
      setCustomPromptInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to add prompt");
    }
  };

  const sendTeleprompter = async () => {
    if (!session || !room || teleprompterText.trim().length === 0) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/stage-message`,
        payload: {
          playerId: session.playerId,
          text: teleprompterText,
          kind: "teleprompter",
          durationMs: 10000,
        },
        mutate,
      });
      setTeleprompterText("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to send line");
    }
  };

  const triggerIntermission = async () => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/stage-message`,
        payload: {
          playerId: session.playerId,
          text: "Intermission! Hang tight.",
          kind: "intermission",
          durationMs: intermissionSeconds * 1000,
        },
        mutate,
      });
      playSting();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to start intermission");
    }
  };

  const sendReaction = async (emoji: ReactionEmoji) => {
    if (!session || !room) return;
    try {
      await postAction({
        path: `/api/rooms/${session.roomCode}/react`,
        payload: { reaction: emoji },
        mutate,
      });
    } catch {
      // ignore errors silently
    }
  };

  const hasSubmitted = session && currentRound
    ? answeredIds.has(session.playerId)
    : false;
  const hasVoted = session && currentRound ? votedIds.has(session.playerId) : false;
  const canSpeakPrompt =
    Boolean(currentRound?.prompt) && speechSupported && voiceEnabled;

  const speakCurrentPrompt = useCallback(() => {
    if (currentRound?.prompt) {
      speakPrompt(currentRound.prompt);
    }
  }, [currentRound, speakPrompt]);

  const themeClass = room ? `theme-${room.theme}` : "theme-neon";

  const phaseClass = room ? `phase-${room.phase}` : "";

  return (
    <div className={`container ${themeClass} ${phaseClass}`}>
      <AchievementContainer achievements={achievements} onDismiss={dismissAchievement} />

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
                Avatar
                <select
                  value={createForm.avatar}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, avatar: event.target.value }))
                  }
                >
                  {AVATARS.map((avatar) => (
                    <option key={avatar} value={avatar}>
                      {avatar}
                    </option>
                  ))}
                </select>
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
                Avatar
                <select
                  value={joinForm.avatar}
                  onChange={(event) =>
                    setJoinForm((prev) => ({ ...prev, avatar: event.target.value }))
                  }
                >
                  {AVATARS.map((avatar) => (
                    <option key={avatar} value={avatar}>
                      {avatar}
                    </option>
                  ))}
                </select>
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
            <div className="session-actions">
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className={`secondary sound-toggle ${soundEnabled ? "" : "off"}`}
              >
                {soundEnabled ? "Sound on" : "Sound off"}
              </button>
              <button
                type="button"
                onClick={() => setVoiceEnabled((prev) => !prev)}
                className={`secondary sound-toggle ${voiceEnabled ? "" : "off"}`}
                disabled={!speechSupported}
              >
                {speechSupported
                  ? voiceEnabled
                    ? "Voice on"
                    : "Voice off"
                  : "Voice unavailable"}
              </button>
              <button onClick={handleLeave} className="secondary danger">
                Leave room
              </button>
            </div>
          </div>

          {!room && !error && <p>Loading room...</p>}

          {room && (
            <>
              {/* Timer bar for prompt/vote phases */}
              {currentRound?.deadline && (room.phase === "prompt" || room.phase === "vote") && (
                <TimerBar deadline={currentRound.deadline} warningThreshold={10} />
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={`phase-${room.code}-${room.phase}-${room.currentRoundIndex ?? -1}`}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                >
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
                    canSpeakPrompt={canSpeakPrompt}
                    onSpeakPrompt={speakCurrentPrompt}
                    speechSupported={speechSupported}
                  />
                </motion.div>
              </AnimatePresence>
              <motion.div layout transition={{ type: "spring", stiffness: 120, damping: 18 }}>
                <Scoreboard room={room} answeredIds={answeredIds} votedIds={votedIds} />
                <ReactionBar onReact={sendReaction} disabled={!session} />
              </motion.div>
              {session.isHost && (
                <HostPanel
                  room={room}
                  stagePath={`/stage/${session.roomCode}`}
                  onAdvance={advancePhaseAction}
                  onSpeakPrompt={speakCurrentPrompt}
                  canSpeakPrompt={canSpeakPrompt}
                  playFanfare={playFanfare}
                  playBuzzer={playBuzzer}
                  playApplause={playApplause}
                  playLaugh={playLaugh}
                  playSting={playSting}
                  playDrumroll={playDrumroll}
                  onThemeChange={updateTheme}
                  onSettingsChange={updateSettings}
                  teleprompterText={teleprompterText}
                  setTeleprompterText={setTeleprompterText}
                  onSendTeleprompter={sendTeleprompter}
                  intermissionSeconds={intermissionSeconds}
                  setIntermissionSeconds={setIntermissionSeconds}
                  onStartIntermission={triggerIntermission}
                  musicPlaying={bgm.playing}
                  onToggleMusic={bgm.toggle}
                  showSettings={showSettings}
                  setShowSettings={setShowSettings}
                  customPromptInput={customPromptInput}
                  setCustomPromptInput={setCustomPromptInput}
                  onAddCustomPrompt={addCustomPrompt}
                />
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ReactionBar({
  onReact,
  disabled,
}: {
  onReact: (emoji: ReactionEmoji) => void;
  disabled: boolean;
}) {
  return (
    <div className="reaction-bar">
      <p className="muted small">React:</p>
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-chip"
          onClick={() => onReact(emoji)}
          disabled={disabled}
        >
          {emoji}
        </button>
      ))}
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
  onSpeakPrompt: () => void;
  canSpeakPrompt: boolean;
  speechSupported: boolean;
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
  onSpeakPrompt,
  canSpeakPrompt,
  speechSupported,
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
          {speechSupported ? (
            <button
              type="button"
              className="ghost"
              onClick={onSpeakPrompt}
              disabled={!canSpeakPrompt}
            >
              🔊 Read this prompt aloud
            </button>
          ) : (
            <p className="muted small">
              Voice playback is not supported in this browser.
            </p>
          )}

          {/* Typing indicator */}
          <div className="typing-indicator">
            <span>{currentRound?.submissions.length || 0}/{room.players.length} players answered</span>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

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

          {/* Vote progress */}
          <div className="vote-progress">
            <div className="vote-progress-bar">
              <div
                className="vote-progress-fill"
                style={{ width: `${((currentRound?.votes.length || 0) / Math.max(1, room.players.length - 1)) * 100}%` }}
              />
            </div>
            <span className="vote-progress-text">
              {currentRound?.votes.length || 0}/{room.players.length - 1} votes
            </span>
          </div>

          {currentRound?.submissions.length === 0 && (
            <p>No submissions yet. Host can skip ahead.</p>
          )}
          <div className="submission-list">
            {currentRound?.submissions.map((submission) => {
              const isSelf = submission.playerId === session.playerId;
              return (
                <motion.button
                  key={submission.id}
                  onClick={() => onSubmitVote(submission.id)}
                  disabled={hasVoted || isSelf}
                  className="submission"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <p>{submission.text}</p>
                  {isSelf && <span className="tag">Yours</span>}
                </motion.button>
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
            {currentRound?.submissions.map((submission, index) => {
              const votes = submission.voters.length;
              const author = room.players.find(
                (player) => player.id === submission.playerId,
              );
              const isWinner = index === 0 || votes === Math.max(...(currentRound?.submissions.map(s => s.voters.length) || [0]));
              return (
                <motion.div
                  key={submission.id}
                  className={`result ${isWinner && votes > 0 ? "winner" : ""}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.15 }}
                >
                  <p>{submission.text}</p>
                  <p className="muted">
                    <span className={isWinner && votes > 0 ? "winner-avatar" : ""}>{author?.avatar}</span>{" "}
                    {author?.name ?? "Unknown"} · {votes} vote
                    {votes === 1 ? "" : "s"}
                    {author?.streak && author.streak >= 2 && (
                      <span className="streak-badge">🔥 {author.streak}</span>
                    )}
                  </p>
                </motion.div>
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
          <ResultsCard room={room} />
          {session.isHost && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "center" }}>
              <button onClick={onAdvance} className="rematch-button">
                🔄 Play Again
              </button>
            </div>
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
      <motion.ul layout>
        <AnimatePresence>
          {players.map((player, index) => (
            <motion.li
              layout
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div>
                <strong>
                  <span aria-hidden="true" className={index === 0 && room.phase !== "lobby" ? "winner-avatar" : ""}>
                    {player.avatar}
                  </span>{" "}
                  {player.name}
                </strong>
                {room.hostId === player.id && <span className="tag">Host</span>}
                {player.streak >= 2 && (
                  <span className="streak-badge">🔥 {player.streak}</span>
                )}
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
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

function HostPanel({
  room,
  stagePath,
  onAdvance,
  onSpeakPrompt,
  canSpeakPrompt,
  playFanfare,
  playBuzzer,
  playApplause,
  playLaugh,
  playSting,
  playDrumroll,
  onThemeChange,
  onSettingsChange,
  teleprompterText,
  setTeleprompterText,
  onSendTeleprompter,
  intermissionSeconds,
  setIntermissionSeconds,
  onStartIntermission,
  musicPlaying,
  onToggleMusic,
  showSettings,
  setShowSettings,
  customPromptInput,
  setCustomPromptInput,
  onAddCustomPrompt,
}: {
  room: PublicRoomState;
  stagePath: string;
  onAdvance: () => Promise<void>;
  onSpeakPrompt: () => void;
  canSpeakPrompt: boolean;
  playFanfare: () => void;
  playBuzzer: () => void;
  playApplause: () => void;
  playLaugh: () => void;
  playSting: () => void;
  playDrumroll: () => void;
  onThemeChange: (theme: ThemeName) => void;
  onSettingsChange: (settings: Record<string, unknown>) => void;
  teleprompterText: string;
  setTeleprompterText: (value: string) => void;
  onSendTeleprompter: () => void;
  intermissionSeconds: number;
  setIntermissionSeconds: (value: number) => void;
  onStartIntermission: () => void;
  musicPlaying: boolean;
  onToggleMusic: () => void;
  showSettings: boolean;
  setShowSettings: (value: boolean) => void;
  customPromptInput: string;
  setCustomPromptInput: (value: string) => void;
  onAddCustomPrompt: () => void;
}) {
  const [stageUrl, setStageUrl] = useState(stagePath);
  const [copied, setCopied] = useState(false);
  const updateStageUrl = useEffectEvent((value: string) => {
    setStageUrl(value);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    updateStageUrl(new URL(stagePath, window.location.origin).toString());
  }, [stagePath]);

  const copyLink = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(stageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const toggleCategory = (cat: PromptCategory) => {
    const current = room.settings?.categories || [];
    const newCategories = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    onSettingsChange({ categories: newCategories });
  };

  return (
    <div className="host-panel">
      <div className="host-panel-header">
        <div>
          <p className="eyebrow">Host control room</p>
          <h3>Keep the show moving</h3>
        </div>
        <span className="tag">Live</span>
      </div>
      <p className="muted small">
        Open the presenter view on a big screen for everyone to watch.
      </p>
      <div className="host-stage-link">
        <code>{stageUrl}</code>
        <button type="button" className="secondary" onClick={copyLink}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <div className="host-actions">
        <label className="muted small" htmlFor="theme-select">
          Theme
        </label>
        <select
          id="theme-select"
          value={room.theme}
          onChange={(event) => onThemeChange(event.target.value as ThemeName)}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {theme.toUpperCase()}
            </option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={onToggleMusic}>
          {musicPlaying ? "Pause background music" : "Play background music"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? "Hide settings" : "⚙️ Settings"}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && room.phase === "lobby" && (
        <div className="settings-panel">
          <h4>Game Settings</h4>
          <div className="settings-row">
            <span className="settings-label">⚡ Speed Mode (30s rounds)</span>
            <div
              className={`toggle-switch ${room.settings?.speedMode ? "active" : ""}`}
              onClick={() => onSettingsChange({ speedMode: !room.settings?.speedMode })}
            />
          </div>

          <div style={{ marginTop: "1rem" }}>
            <p className="muted small">Prompt Categories:</p>
            <div className="category-tags">
              {PROMPT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-tag ${(room.settings?.categories || []).includes(cat) ? "active" : ""}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <p className="muted small">Custom Prompts ({room.customPrompts?.length || 0}):</p>
            {room.customPrompts && room.customPrompts.length > 0 && (
              <ul className="custom-prompts-list">
                {room.customPrompts.map((prompt, i) => (
                  <li key={i} className="custom-prompt-item">
                    {prompt.slice(0, 50)}{prompt.length > 50 ? "..." : ""}
                  </li>
                ))}
              </ul>
            )}
            <div className="host-teleprompter" style={{ marginTop: "0.5rem" }}>
              <input
                value={customPromptInput}
                onChange={(e) => setCustomPromptInput(e.target.value)}
                placeholder="Add a custom prompt..."
              />
              <button
                type="button"
                className="secondary"
                onClick={onAddCustomPrompt}
                disabled={!customPromptInput.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="host-actions">
        <button type="button" className="primary" onClick={onAdvance}>
          {room.phase === "vote" ? "Reveal results" : "Advance phase"}
        </button>
        <button type="button" className="secondary" onClick={playDrumroll}>
          🥁 Drumroll
        </button>
        <button type="button" className="secondary" onClick={playFanfare}>
          Play fanfare
        </button>
        <button type="button" className="secondary" onClick={playBuzzer}>
          Play buzzer
        </button>
      </div>
      <div className="host-actions">
        <button type="button" className="secondary" onClick={playApplause}>
          Applause
        </button>
        <button type="button" className="secondary" onClick={playLaugh}>
          Laugh track
        </button>
        <button type="button" className="secondary" onClick={playSting}>
          Drama sting
        </button>
      </div>
      <div className="host-teleprompter">
        <input
          value={teleprompterText}
          onChange={(event) => setTeleprompterText(event.target.value)}
          placeholder="Drop a host line..."
        />
        <button
          type="button"
          className="secondary"
          onClick={onSendTeleprompter}
          disabled={teleprompterText.trim().length === 0}
        >
          Send cue
        </button>
      </div>
      <div className="host-actions">
        <label className="muted small">
          Intermission length (seconds)
          <input
            type="number"
            min={5}
            max={60}
            value={intermissionSeconds}
            onChange={(event) => {
              const value = Number(event.target.value);
              setIntermissionSeconds(Number.isNaN(value) ? 15 : value);
            }}
          />
        </label>
        <button type="button" className="secondary" onClick={onStartIntermission}>
          Start intermission
        </button>
      </div>
      <div className="host-actions">
        <button
          type="button"
          className="ghost"
          onClick={onSpeakPrompt}
          disabled={!canSpeakPrompt}
        >
          🔊 Read current prompt
        </button>
        <p className="muted small">
          Stage view mirrors the players&apos; progress in real time.
        </p>
      </div>
    </div>
  );
}
