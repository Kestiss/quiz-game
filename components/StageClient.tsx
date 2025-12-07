"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { PublicRoomState, RoundState, ReactionEmoji } from "@/types/game";
import { useSpeech } from "@/hooks/useSpeech";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { useSoundBoard } from "@/hooks/useSoundBoard";
import { getPersonaLine, getPersonaMeta, getReactionComment } from "@/lib/persona";
import { FloatingReactions } from "./FloatingReaction";
import { QRCodeDisplay } from "./QRCodeDisplay";

const fetcher = async (url: string): Promise<PublicRoomState> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load room");
  }
  return payload.room as PublicRoomState;
};

interface StageClientProps {
  code: string;
}

export function StageClient({ code }: StageClientProps) {
  const upperCode = code.toUpperCase();
  const personaMeta = getPersonaMeta();
  const { data: room, error } = useSWR(
    `/api/rooms/${upperCode}`,
    fetcher,
    { refreshInterval: 1500 },
  );

  const currentRound: RoundState | undefined = room &&
    room.currentRoundIndex >= 0 &&
    room.rounds[room.currentRoundIndex]
    ? (room.rounds[room.currentRoundIndex] as RoundState)
    : undefined;

  const celebrationRef = useRef<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [personaLine, setPersonaLine] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [revealedAnswers, setRevealedAnswers] = useState<string[]>([]);
  const { speak: personaSpeak, supported: personaVoiceSupported } = useSpeech(voiceEnabled);
  const stageMusic = useBackgroundMusic();
  const { playCheer, playPop, playTick, playUrgent } = useSoundBoard(true);

  const prevReactionsRef = useRef<Record<ReactionEmoji, number> | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!room) return;
    const signature = `${room.code}-${room.currentRoundIndex}-${room.phase}`;
    if (
      (room.phase === "results" || room.phase === "finished") &&
      celebrationRef.current !== signature
    ) {
      celebrationRef.current = signature;
      fireConfetti();
      playCheer();
    }
    if (room.phase === "prompt") {
      celebrationRef.current = null;
    }
  }, [room, playCheer]);

  useEffect(() => {
    if (room?.phase === "vote" && currentRound) {
      setRevealedAnswers([]);
      const submissions = currentRound.submissions;
      submissions.forEach((sub, index) => {
        setTimeout(() => {
          setRevealedAnswers(prev => [...prev, sub.id]);
          playPop();
        }, (index + 1) * 800);
      });
    }
  }, [room?.phase, room?.currentRoundIndex, currentRound, playPop]);

  useEffect(() => {
    if (!currentRound?.deadline) return;
    const remaining = Math.ceil((currentRound.deadline - now) / 1000);
    if (remaining === 10) {
      playUrgent();
    } else if (remaining <= 5 && remaining > 0) {
      playTick();
    }
  }, [now, currentRound?.deadline, playUrgent, playTick]);

  const applyPersonaLine = useEffectEvent((line: string) => setPersonaLine(line));

  useEffect(() => {
    if (!room) return;
    const line = getPersonaLine(room, currentRound);
    applyPersonaLine(line);
    if (voiceEnabled) {
      personaSpeak(line);
    }
  }, [room?.phase, room?.currentRoundIndex, currentRound, personaSpeak, room, voiceEnabled]);

  useEffect(() => {
    if (!room || !prevReactionsRef.current) {
      prevReactionsRef.current = room?.reactions ?? null;
      return;
    }

    const prev = prevReactionsRef.current;
    const current = room.reactions;

    (Object.keys(current) as ReactionEmoji[]).forEach((emoji) => {
      const diff = current[emoji] - (prev[emoji] || 0);
      if (diff >= 3) {
        const comment = getReactionComment(emoji);
        applyPersonaLine(comment);
        if (voiceEnabled) {
          personaSpeak(comment);
        }
      }
    });

    prevReactionsRef.current = current;
  }, [room?.reactions, voiceEnabled, personaSpeak]);

  const tickerNames = useMemo(() => {
    if (!room) return [];
    return [...room.players].sort((a, b) => b.score - a.score);
  }, [room]);

  const activeStageMessage =
    room?.stageMessage && room.stageMessage.expiresAt > now
      ? room.stageMessage
      : null;

  // Calculate timer progress
  const timerProgress = currentRound?.deadline
    ? Math.max(0, Math.min(100, ((currentRound.deadline - now) / (room?.settings?.promptDuration || 60) / 1000) * 100))
    : 100;
  const timerSeconds = currentRound?.deadline
    ? Math.max(0, Math.ceil((currentRound.deadline - now) / 1000))
    : 0;
  const isUrgent = timerSeconds <= 10 && timerSeconds > 0;

  return (
    <div className={`tv-stage theme-${room?.theme ?? "neon"}`}>
      {/* Floating reactions */}
      {room && <FloatingReactions reactions={room.reactions} />}

      {activeStageMessage && (
        <div className="tv-message-overlay">
          <div className="tv-message-bubble">
            {activeStageMessage.kind === "intermission" ? "⏱️ " : "🎙️ "}
            {activeStageMessage.text}
          </div>
        </div>
      )}

      {/* Top bar - Room code, round info, controls */}
      <header className="tv-topbar">
        <div className="tv-brand">
          <span className="tv-logo">🎙️</span>
          <span className="tv-title">Party Prompts</span>
        </div>

        <div className="tv-round-info">
          {room && `Round ${Math.max(1, room.currentRoundIndex + 1)} of ${room.roundsToPlay}`}
        </div>

        <div className="tv-join-section">
          <div className="tv-code-display">
            <span className="tv-code-label">JOIN:</span>
            <span className="tv-code">{upperCode}</span>
          </div>
          <QRCodeDisplay roomCode={upperCode} size={55} />
        </div>

        {/* Reactions in top bar */}
        {room && (
          <div className="tv-topbar-reactions">
            {Object.entries(room.reactions).map(([emoji, count]) => (
              <span key={emoji} className="tv-reaction">
                {emoji}{count}
              </span>
            ))}
          </div>
        )}

        <div className="tv-controls">
          {personaVoiceSupported && (
            <button type="button" className="tv-btn" onClick={() => setVoiceEnabled((prev) => !prev)}>
              {voiceEnabled ? "🔊" : "🔇"}
            </button>
          )}
          <button type="button" className="tv-btn" onClick={stageMusic.toggle}>
            {stageMusic.playing ? "🎵" : "🎵"}
          </button>
        </div>
      </header>

      {/* Host persona bar - after top bar */}
      <div className="tv-host-bar">
        <span className="tv-persona-avatar">{personaMeta.avatar}</span>
        <span className="tv-persona-name">{personaMeta.name}</span>
        <span className="tv-persona-line">{personaLine}</span>
      </div>

      {/* Timer bar */}
      {currentRound?.deadline && (room?.phase === "prompt" || room?.phase === "vote") && (
        <div className={`tv-timer-bar ${isUrgent ? "urgent" : ""}`}>
          <div className="tv-timer-fill" style={{ width: `${timerProgress}%` }} />
          <span className="tv-timer-text">{timerSeconds}s</span>
        </div>
      )}

      {/* Main content area */}
      <main className="tv-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${room?.phase ?? "loading"}-${room?.currentRoundIndex ?? -1}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="tv-content"
          >
            <TVPhase
              room={room}
              currentRound={currentRound}
              error={error}
              revealedAnswers={revealedAnswers}
            />
          </motion.div>
        </AnimatePresence>

        {/* Scoreboard sidebar */}
        <aside className="tv-sidebar">
          <div className="tv-scoreboard">
            <h3>🏆 Leaderboard</h3>
            {room ? (
              <ul>
                {tickerNames.slice(0, 8).map((player, index) => (
                  <motion.li
                    key={player.id}
                    layout
                    className={index === 0 ? "leader" : ""}
                  >
                    <span className="tv-rank">{index + 1}</span>
                    <span className="tv-avatar">{player.avatar}</span>
                    <span className="tv-name">{player.name}</span>
                    {player.streak >= 2 && <span className="tv-streak">🔥{player.streak}</span>}
                    <span className="tv-score">{player.score}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="tv-waiting">Waiting for players...</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function TVPhase({
  room,
  currentRound,
  error,
  revealedAnswers = [],
}: {
  room?: PublicRoomState;
  currentRound?: RoundState;
  error?: Error;
  revealedAnswers?: string[];
}) {
  if (error) {
    return (
      <div className="tv-phase tv-error">
        <h2>📡 Connection Lost</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="tv-phase tv-loading">
        <h2>🎬 Setting the Stage...</h2>
        <p>Waiting for the show to begin</p>
      </div>
    );
  }

  switch (room.phase) {
    case "lobby":
      return (
        <div className="tv-phase tv-lobby">
          <h2>👋 Welcome to the Lobby!</h2>
          <p className="tv-phase-subtitle">Scan the QR code or enter the room code to join</p>
          <div className="tv-player-grid">
            <AnimatePresence>
              {room.players.map((player, index) => (
                <motion.div
                  key={player.id}
                  className="tv-player-card"
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <span className="tv-player-avatar">{player.avatar}</span>
                  <span className="tv-player-name">{player.name}</span>
                  {room.hostId === player.id && <span className="tv-host-badge">HOST</span>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <p className="tv-player-count">{room.players.length} player{room.players.length === 1 ? "" : "s"} ready</p>
        </div>
      );

    case "prompt":
      return (
        <div className="tv-phase tv-prompt">
          <p className="tv-phase-label">✍️ THE PROMPT</p>
          <motion.h2
            className="tv-prompt-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {currentRound?.prompt}
          </motion.h2>
          <div className="tv-status">
            <span className="tv-status-icon">📝</span>
            <span>{currentRound?.submissions.length || 0} of {room.players.length} have answered</span>
          </div>
        </div>
      );

    case "vote": {
      const submissions = currentRound?.submissions ?? [];
      return (
        <div className="tv-phase tv-vote">
          <p className="tv-phase-label">🗳️ VOTE NOW</p>
          <div className="tv-answers-grid">
            {submissions.map((submission, index) => (
              <AnimatePresence key={submission.id}>
                {revealedAnswers.includes(submission.id) && (
                  <motion.div
                    className="tv-answer-card"
                    initial={{ opacity: 0, rotateY: -90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                  >
                    <span className="tv-answer-letter">{String.fromCharCode(65 + index)}</span>
                    <p className="tv-answer-text">{submission.text}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
          <div className="tv-vote-progress">
            <div className="tv-vote-bar">
              <div
                className="tv-vote-fill"
                style={{ width: `${((currentRound?.votes.length || 0) / Math.max(1, room.players.length - 1)) * 100}%` }}
              />
            </div>
            <span className="tv-vote-count">{currentRound?.votes.length || 0}/{room.players.length - 1} voted</span>
          </div>
        </div>
      );
    }

    case "results": {
      const sorted = [...(currentRound?.submissions ?? [])].sort(
        (a, b) => b.voters.length - a.voters.length,
      );
      const winner = sorted[0];
      const winnerPlayer = room.players.find((p) => p.id === winner?.playerId);

      return (
        <div className="tv-phase tv-results">
          <p className="tv-phase-label">🎉 WINNER!</p>
          {winner && (
            <motion.div
              className="tv-winner-card"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <div className="tv-winner-answer">{winner.text}</div>
              <div className="tv-winner-author">
                <span className="tv-winner-avatar">{winnerPlayer?.avatar}</span>
                <span className="tv-winner-name">{winnerPlayer?.name}</span>
                <span className="tv-winner-votes">{winner.voters.length} vote{winner.voters.length === 1 ? "" : "s"}</span>
                {winnerPlayer?.streak && winnerPlayer.streak >= 2 && (
                  <span className="tv-winner-streak">🔥 {winnerPlayer.streak} streak!</span>
                )}
              </div>
            </motion.div>
          )}
          <p className="tv-prompt-reminder">Prompt: {currentRound?.prompt}</p>
        </div>
      );
    }

    case "finished": {
      const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
      return (
        <div className="tv-phase tv-finished">
          <p className="tv-phase-label">🏆 FINAL STANDINGS</p>
          <div className="tv-podium">
            {sortedPlayers.slice(0, 3).map((player, index) => (
              <motion.div
                key={player.id}
                className={`tv-podium-spot tv-podium-${index + 1}`}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (2 - index) * 0.3 }}
              >
                <span className="tv-podium-medal">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                </span>
                <span className="tv-podium-avatar">{player.avatar}</span>
                <span className="tv-podium-name">{player.name}</span>
                <span className="tv-podium-score">{player.score} pts</span>
              </motion.div>
            ))}
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="tv-phase">
          <h2>🎬 Coming Up Next...</h2>
        </div>
      );
  }
}

function fireConfetti() {
  if (typeof window === "undefined") return;
  const colors = ["#ff6ad5", "#5de0e6", "#ffd700", "#ff6b6b"];

  void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors });
  setTimeout(() => {
    void confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 }, colors });
  }, 200);
  setTimeout(() => {
    void confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 }, colors });
  }, 400);
}
