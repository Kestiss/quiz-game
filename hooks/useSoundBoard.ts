"use client";

import { useCallback, useEffect, useRef } from "react";

interface SoundBoard {
  playJoin: () => void;
  playSubmit: () => void;
  playVote: () => void;
  playAdvance: () => void;
  playFanfare: () => void;
  playBuzzer: () => void;
}

type OscOptions = {
  start: number;
  end: number;
  duration: number;
  type?: OscillatorType;
};

export function useSoundBoard(enabled: boolean): SoundBoard {
  const contextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return null;
    }
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }
    if (contextRef.current.state === "suspended") {
      contextRef.current.resume();
    }
    return contextRef.current;
  }, [enabled]);

  useEffect(
    () => () => {
      contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  const playChirp = useCallback(
    (options: OscOptions) => {
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = options.type ?? "sine";
      osc.frequency.setValueAtTime(options.start, now);
      osc.frequency.exponentialRampToValueAtTime(options.end, now + options.duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + options.duration + 0.05);
    },
    [getContext],
  );

  const playJoin = useCallback(() => {
    playChirp({ start: 440, end: 880, duration: 0.35, type: "triangle" });
  }, [playChirp]);

  const playSubmit = useCallback(() => {
    playChirp({ start: 320, end: 640, duration: 0.3, type: "square" });
  }, [playChirp]);

  const playVote = useCallback(() => {
    playChirp({ start: 550, end: 990, duration: 0.2, type: "sawtooth" });
    setTimeout(() => playChirp({ start: 660, end: 440, duration: 0.25 }), 160);
  }, [playChirp]);

  const playAdvance = useCallback(() => {
    playChirp({ start: 300, end: 700, duration: 0.4, type: "triangle" });
  }, [playChirp]);

  const playFanfare = useCallback(() => {
    playChirp({ start: 500, end: 900, duration: 0.35, type: "triangle" });
    setTimeout(() => playChirp({ start: 450, end: 800, duration: 0.35, type: "square" }), 180);
    setTimeout(() => playChirp({ start: 300, end: 600, duration: 0.5, type: "sine" }), 360);
  }, [playChirp]);

  const playBuzzer = useCallback(() => {
    playChirp({ start: 500, end: 120, duration: 0.5, type: "sawtooth" });
  }, [playChirp]);

  return { playJoin, playSubmit, playVote, playAdvance, playFanfare, playBuzzer };
}
