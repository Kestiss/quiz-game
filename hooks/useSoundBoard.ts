"use client";

import { useCallback, useEffect, useRef } from "react";

interface SoundBoard {
  playJoin: () => void;
  playSubmit: () => void;
  playVote: () => void;
  playAdvance: () => void;
  playFanfare: () => void;
  playBuzzer: () => void;
  playApplause: () => void;
  playLaugh: () => void;
  playSting: () => void;
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

  const playNoise = useCallback(
    (duration: number, volume = 0.2, delay = 0) => {
      const ctx = getContext();
      if (!ctx) return;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(gain).connect(ctx.destination);
      source.start(start);
    },
    [getContext],
  );

  const playApplause = useCallback(() => {
    playNoise(1.2, 0.25);
    setTimeout(() => playNoise(0.9, 0.18), 150);
  }, [playNoise]);

  const playLaugh = useCallback(() => {
    playNoise(0.5, 0.18);
    setTimeout(() => playNoise(0.4, 0.15), 400);
    setTimeout(() => playNoise(0.3, 0.12), 750);
  }, [playNoise]);

  const playSting = useCallback(() => {
    playChirp({ start: 200, end: 800, duration: 0.4, type: "triangle" });
    setTimeout(() => playChirp({ start: 800, end: 600, duration: 0.25, type: "square" }), 300);
  }, [playChirp]);

  return {
    playJoin,
    playSubmit,
    playVote,
    playAdvance,
    playFanfare,
    playBuzzer,
    playApplause,
    playLaugh,
    playSting,
  };
}
