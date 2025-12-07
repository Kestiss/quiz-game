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
import { CountdownTimer, TimerBar } from "./CountdownTimer";
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
  const { playDrumroll, playReveal, playWhoosh, playPop, playCheer, playTick, playUrgent } = useSoundBoard(true);

  // Track previous reactions for floating effect
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

  // Handle dramatic reveal during vote phase
  useEffect(() => {
    if (room?.phase === "vote" && currentRound) {
      setRevealedAnswers([]);
      // Reveal answers one by one with delays
      const submissions = currentRound.submissions;
      submissions.forEach((sub, index) => {
        setTimeout(() => {
          setRevealedAnswers(prev => [...prev, sub.id]);
          playPop();
        }, (index + 1) * 800);
      });
    }
  }, [room?.phase, room?.currentRoundIndex, currentRound, playPop]);

  // Play drumroll before results
  useEffect(() => {
    if (room?.phase === "vote") {
      // Could trigger drumroll when host is about to reveal
    }
  }, [room?.phase]);

  // Timer warning sounds
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

  // React to reactions with persona comments
  useEffect(() => {
    if (!room || !prevReactionsRef.current) {
      prevReactionsRef.current = room?.reactions ?? null;
      return;
    }

    const prev = prevReactionsRef.current;
    const current = room.reactions;

    // Check if any reaction increased significantly
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

  const headline = (() => {
    if (!room) return "Awaiting players...";
    switch (room.phase) {
      case "lobby":
        return "Lobby is open";
      case "prompt":
        return "Writers' Room";
      case "vote":
        return "Studio Vote";
      case "results":
        return "Results Reveal";
      case "finished":
        return "Finale";
      default:
        return "On Air";
    }
  })();

  const tickerNames = useMemo(() => {
    if (!room) return [];
    return [...room.players].sort((a, b) => b.score - a.score);
  }, [room]);

  const activeStageMessage =
    room?.stageMessage && room.stageMessage.expiresAt > now
      ? room.stageMessage
      : null;

  return (
    <div
      className={`stage-wrapper theme-${room?.theme ?? "neon"} phase-${room?.phase ?? "lobby"}`}
    >
      <div className="stage-overlay" />

      {/* Floating reactions */}
      {room && <FloatingReactions reactions={room.reactions} />}

      {activeStageMessage && (
        <div className="stage-message-overlay">
          <div className="bubble">
            {activeStageMessage.kind === "intermission" ? "⏱️ " : "🎙️ "}
            {activeStageMessage.text}
          </div>
        </div>
      )}
      <div className="stage-content">
        <header className="stage-header">
          <div>
            <p className="eyebrow">Showtime</p>
            <h1>{headline}</h1>
            <p className="stage-subline">
              {room
                ? `Round ${Math.max(1, room.currentRoundIndex + 1)} of ${room.roundsToPlay}`
                : "Connecting to studio..."}
            </p>
          </div>
          <div className="stage-code-card">
            <p className="eyebrow">Room Code</p>
            <p className="stage-code">{upperCode}</p>
            <QRCodeDisplay roomCode={upperCode} size={80} />
            {personaVoiceSupported && (
              <button
                type="button"
                className="secondary"
                onClick={() => setVoiceEnabled((prev) => !prev)}
              >
                {voiceEnabled ? "Mute host" : "Unmute host"}
              </button>
            )}
          </div>
        </header>

        <div className="persona-panel">
          <motion.div
            className="persona-avatar"
            animate={room?.phase === "results" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {personaMeta.avatar}
          </motion.div>
          <div>
            <p className="eyebrow">{personaMeta.name}</p>
            <p className="persona-line">{personaLine}</p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={stageMusic.toggle}
          >
            {stageMusic.playing ? "Pause music" : "Play music"}
          </button>
        </div>

        {/* Timer bar for prompt/vote phases */}
        {currentRound?.deadline && (room?.phase === "prompt" || room?.phase === "vote") && (
          <TimerBar deadline={currentRound.deadline} warningThreshold={10} />
        )}

        <main className="stage-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${room?.phase ?? "loading"}-${room?.currentRoundIndex ?? -1}`}
              initial={{ opacity: 0, y: 25, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -25, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="stage-panel"
            >
              <StagePhase
                room={room}
                currentRound={currentRound}
                error={error}
                revealedAnswers={revealedAnswers}
              />
            </motion.div>
          </AnimatePresence>

          <motion.div layout className="stage-scoreboard">
            <h3>Scoreboard</h3>
            {room ? (
              <ul>
                {tickerNames.map((player, index) => (
                  <motion.li
                    key={player.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <span className="rank">{index + 1}</span>
                    <span className="name">
                      <span aria-hidden="true" className={index === 0 && room.phase === "results" ? "winner-avatar" : ""}>
                        {player.avatar}
                      </span>{" "}
                      {player.name}
                      {player.streak >= 2 && (
                        <span className="streak-badge">🔥 {player.streak}</span>
                      )}
                    </span>
                    <span className="points">{player.score} pts</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="muted">Waiting for players...</p>
            )}
            {room && (
              <div className="stage-reactions">
                {Object.entries(room.reactions).map(([emoji, count]) => (
                  <motion.span
                    key={emoji}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.3 }}
                  >
                    {emoji} {count}
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      <footer className="stage-ticker">
        <div className="ticker-track">
          {tickerNames.length === 0 ? (
            <span>Party Prompts is live — waiting for contestants...</span>
          ) : (
            tickerNames.map((player) => (
              <span key={player.id}>
                {player.name.toUpperCase()} • {player.score} PTS
                {player.streak >= 2 ? ` 🔥${player.streak}` : ""}
              </span>
            ))
          )}
        </div>
      </footer>
    </div>
  );
}

function StagePhase({
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
      <div className="stage-phase">
        <h2>Studio feed lost</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="stage-phase">
        <h2>Syncing with control room…</h2>
        <p>Waiting for the host to go live.</p>
      </div>
    );
  }

  switch (room.phase) {
    case "lobby":
      return (
        <div className="stage-phase">
          <p className="eyebrow">Contestants</p>
          <div className="stage-grid">
            <AnimatePresence>
              {room.players.map((player, index) => (
                <motion.div
                  key={player.id}
                  className="stage-tile"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <p>
                    <span aria-hidden="true">{player.avatar}</span> {player.name}
                  </p>
                  {room.hostId === player.id && <span className="tag">Host</span>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <p className="muted">Share the room code above to join the lobby.</p>
        </div>
      );
    case "prompt":
      return (
        <div className="stage-phase">
          <p className="eyebrow">Tonight&rsquo;s prompt</p>
          <motion.h2
            className="stage-prompt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {currentRound?.prompt}
          </motion.h2>

          {/* Typing indicator */}
          <div className="typing-indicator">
            <span>{currentRound?.submissions.length || 0} of {room.players.length} writers typing</span>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          {/* Timer */}
          {currentRound?.deadline && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
              <CountdownTimer
                deadline={currentRound.deadline}
                size="large"
                warningThreshold={10}
              />
            </div>
          )}
        </div>
      );
    case "vote": {
      const submissions = currentRound?.submissions ?? [];
      return (
        <div className="stage-phase">
          <p className="eyebrow">Studio Vote</p>

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

          <div className="stage-versus">
            {submissions.map((submission, index) => (
              <AnimatePresence key={submission.id}>
                {revealedAnswers.includes(submission.id) && (
                  <motion.div
                    className="stage-answer answer-reveal"
                    initial={{ opacity: 0, y: 30, rotateX: -15 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <p>{submission.text}</p>
                    <span className="muted">Anonymous writer</span>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
            {submissions.length === 0 && (
              <p className="muted">No answers yet. Host may skip ahead.</p>
            )}
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
        <div className="stage-phase">
          <p className="eyebrow">Result Reveal</p>
          {winner ? (
            <motion.div
              className="stage-winner"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <p className="muted">Winning prompt:</p>
              <h2>{currentRound?.prompt}</h2>
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {winner.text}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span className="winner-avatar">{winnerPlayer?.avatar}</span>{" "}
                {winnerPlayer?.name} — {winner.voters.length} vote{winner.voters.length === 1 ? "" : "s"}
                {winnerPlayer?.streak && winnerPlayer.streak >= 2 && (
                  <span className="streak-badge">🔥 {winnerPlayer.streak} streak!</span>
                )}
              </motion.p>
            </motion.div>
          ) : (
            <p>No submissions to score.</p>
          )}
        </div>
      );
    }
    case "finished":
      return (
        <div className="stage-phase">
          <p className="eyebrow">Season Finale</p>
          <ol className="stage-podium">
            {[...room.players]
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <motion.li
                  key={player.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.2 }}
                >
                  <span className="rank">
                    {index === 0 ? "🏆" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                  </span>
                  <span className={index === 0 ? "winner-avatar" : ""}>{player.avatar}</span>
                  <span>{player.name}</span>
                  <span>{player.score} pts</span>
                </motion.li>
              ))}
          </ol>
          <p className="muted">Host can reset the lobby to play again.</p>
        </div>
      );
    default:
      return (
        <div className="stage-phase">
          <h2>Lights warming up…</h2>
        </div>
      );
  }
}

function fireConfetti() {
  if (typeof window === "undefined") return;
  const defaults = { origin: { y: 0.7 } };
  void confetti({ ...defaults, particleCount: 80, spread: 70, startVelocity: 45 });
  setTimeout(() => {
    void confetti({ ...defaults, particleCount: 60, spread: 100, startVelocity: 60 });
  }, 200);
  setTimeout(() => {
    void confetti({ ...defaults, particleCount: 100, spread: 120, startVelocity: 50, colors: ["#ff6ad5", "#5de0e6", "#ffd700"] });
  }, 400);
}
