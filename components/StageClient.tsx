"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { PublicRoomState, RoundState } from "@/types/game";
import { useSpeech } from "@/hooks/useSpeech";
import { getPersonaLine, getPersonaMeta } from "@/lib/persona";

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
  const { speak: personaSpeak, supported: personaVoiceSupported } = useSpeech(voiceEnabled);

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
    }
    if (room.phase === "prompt") {
      celebrationRef.current = null;
    }
  }, [room]);

  const applyPersonaLine = useEffectEvent((line: string) => setPersonaLine(line));

  useEffect(() => {
    if (!room) return;
    const line = getPersonaLine(room, currentRound);
    applyPersonaLine(line);
    if (voiceEnabled) {
      personaSpeak(line);
    }
  }, [room?.phase, room?.currentRoundIndex, currentRound, personaSpeak, room, voiceEnabled]);

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
            <p className="muted small">Join on your phone and watch here.</p>
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
          <div className="persona-avatar">{personaMeta.avatar}</div>
          <div>
            <p className="eyebrow">{personaMeta.name}</p>
            <p className="persona-line">{personaLine}</p>
          </div>
        </div>

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
              <StagePhase room={room} currentRound={currentRound} error={error} />
            </motion.div>
          </AnimatePresence>

          <motion.div layout className="stage-scoreboard">
            <h3>Scoreboard</h3>
            {room ? (
              <ul>
                {tickerNames.map((player, index) => (
                  <li key={player.id}>
                    <span className="rank">{index + 1}</span>
                    <span className="name">
                      <span aria-hidden="true">{player.avatar}</span> {player.name}
                    </span>
                    <span className="points">{player.score} pts</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Waiting for players...</p>
            )}
            {room && (
              <div className="stage-reactions">
                {Object.entries(room.reactions).map(([emoji, count]) => (
                  <span key={emoji}>
                    {emoji} {count}
                  </span>
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
}: {
  room?: PublicRoomState;
  currentRound?: RoundState;
  error?: Error;
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
            {room.players.map((player) => (
              <div key={player.id} className="stage-tile">
                <p>
                  <span aria-hidden="true">{player.avatar}</span> {player.name}
                </p>
                {room.hostId === player.id && <span className="tag">Host</span>}
              </div>
            ))}
          </div>
          <p className="muted">Share the room code above to join the lobby.</p>
        </div>
      );
    case "prompt":
      return (
        <div className="stage-phase">
          <p className="eyebrow">Tonight&rsquo;s prompt</p>
          <h2 className="stage-prompt">{currentRound?.prompt}</h2>
          <p className="muted">
            Answers submitted: {currentRound?.submissions.length ?? 0} / {room.players.length}
          </p>
        </div>
      );
    case "vote": {
      const submissions = currentRound?.submissions ?? [];
      return (
        <div className="stage-phase">
          <p className="eyebrow">Studio Vote</p>
          <div className="stage-versus">
            {submissions.map((submission) => (
              <motion.div
                key={submission.id}
                className="stage-answer"
                initial={{ opacity: 0, y: 30, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.35 }}
              >
                <p>{submission.text}</p>
                <span className="muted">
                  {room.players.find((player) => player.id === submission.playerId)?.name ??
                    "Mystery writer"}
                </span>
              </motion.div>
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
              <h3>{winner.text}</h3>
              <p>
                {winner.voters.length} vote{winner.voters.length === 1 ? "" : "s"} ·{" "}
                {room.players.find((player) => player.id === winner.playerId)?.avatar}{" "}
                {room.players.find((player) => player.id === winner.playerId)?.name}
              </p>
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
                <li key={player.id}>
                  <span className="rank">{index + 1}</span>
                  <span>{player.name}</span>
                  <span>{player.score} pts</span>
                </li>
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
}
