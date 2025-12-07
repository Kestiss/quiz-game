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
  playDrumroll: () => void;
  playWhoosh: () => void;
  playPop: () => void;
  playCheer: () => void;
  playTick: () => void;
  playUrgent: () => void;
  playReveal: () => void;
}

const THEME_MASTER_GAIN = 0.2;

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

  const schedule = useCallback(
    (fn: (ctx: AudioContext, baseTime: number) => void, delay = 0) => {
      const ctx = getContext();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      fn(ctx, start);
    },
    [getContext],
  );

  const tone = (
    ctx: AudioContext,
    start: number,
    options: { duration: number; freq: number; type?: OscillatorType; gain?: number; glideTo?: number },
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(options.freq, start);
    if (options.glideTo && options.glideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(options.glideTo, start + options.duration);
    }
    const level = (options.gain ?? 1) * THEME_MASTER_GAIN;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + options.duration + 0.05);
  };

  const noise = (
    ctx: AudioContext,
    start: number,
    options: { duration: number; gain?: number },
  ) => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * options.duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const level = (options.gain ?? 1) * THEME_MASTER_GAIN;
    gain.gain.setValueAtTime(level, start);
    gain.gain.linearRampToValueAtTime(0.0001, start + options.duration);
    source.connect(gain).connect(ctx.destination);
    source.start(start);
  };

  const playJoin = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.25, freq: 392, type: "triangle" });
      tone(ctx, start + 0.18, { duration: 0.3, freq: 523.25, type: "triangle" });
      tone(ctx, start + 0.36, { duration: 0.35, freq: 659.25, type: "triangle" });
    });
  }, [schedule]);

  const playSubmit = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.15, freq: 660, type: "square" });
      tone(ctx, start + 0.1, { duration: 0.25, freq: 880, type: "square" });
    });
  }, [schedule]);

  const playVote = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.2, freq: 523.25, type: "sawtooth", gain: 0.9 });
      tone(ctx, start + 0.15, { duration: 0.25, freq: 659.25, type: "triangle" });
      tone(ctx, start + 0.3, { duration: 0.3, freq: 783.99, type: "triangle" });
    });
  }, [schedule]);

  const playAdvance = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.35, freq: 261.63, type: "triangle", glideTo: 392 });
      tone(ctx, start, { duration: 0.35, freq: 329.63, type: "triangle", glideTo: 523.25 });
    });
  }, [schedule]);

  const playFanfare = useCallback(() => {
    schedule((ctx, start) => {
      const chord = [523.25, 659.25, 783.99];
      chord.forEach((freq) => tone(ctx, start, { duration: 0.6, freq, type: "square", gain: 1 }));
      chord.forEach((freq) =>
        tone(ctx, start + 0.45, {
          duration: 0.6,
          freq: freq * 1.122,
          type: "triangle",
          gain: 0.8,
        }),
      );
      tone(ctx, start + 0.9, { duration: 0.5, freq: 1046.5, type: "sine", gain: 1.2 });
    });
  }, [schedule]);

  const playBuzzer = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.6, freq: 180, type: "sawtooth", glideTo: 80, gain: 1.2 });
      noise(ctx, start, { duration: 0.4, gain: 0.4 });
    });
  }, [schedule]);

  const playApplause = useCallback(() => {
    schedule((ctx, start) => {
      noise(ctx, start, { duration: 1.4, gain: 0.8 });
      noise(ctx, start + 0.2, { duration: 1.1, gain: 0.6 });
      noise(ctx, start + 0.5, { duration: 0.8, gain: 0.4 });
    });
  }, [schedule]);

  const playLaugh = useCallback(() => {
    schedule((ctx, start) => {
      noise(ctx, start, { duration: 0.5, gain: 0.5 });
      noise(ctx, start + 0.45, { duration: 0.4, gain: 0.35 });
      tone(ctx, start + 0.2, { duration: 0.35, freq: 300, type: "triangle", gain: 0.6 });
      tone(ctx, start + 0.5, { duration: 0.3, freq: 280, type: "triangle", gain: 0.5 });
    });
  }, [schedule]);

  const playSting = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.4, freq: 880, type: "triangle", gain: 0.8 });
      tone(ctx, start + 0.25, { duration: 0.5, freq: 587, type: "sawtooth", gain: 0.9 });
      noise(ctx, start + 0.1, { duration: 0.4, gain: 0.2 });
    });
  }, [schedule]);

  // New sounds for enhanced experience
  const playDrumroll = useCallback(() => {
    schedule((ctx, start) => {
      // Building drumroll effect with rapid noise bursts
      for (let i = 0; i < 20; i++) {
        const t = start + i * 0.08;
        const gain = 0.3 + (i / 20) * 0.5;
        noise(ctx, t, { duration: 0.06, gain });
        tone(ctx, t, { duration: 0.05, freq: 100 + Math.random() * 50, type: "triangle", gain: 0.2 });
      }
      // Final hit
      tone(ctx, start + 1.6, { duration: 0.4, freq: 80, type: "triangle", gain: 1.2 });
      noise(ctx, start + 1.6, { duration: 0.3, gain: 0.8 });
    });
  }, [schedule]);

  const playWhoosh = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.3, freq: 200, type: "sine", glideTo: 800, gain: 0.4 });
      noise(ctx, start, { duration: 0.25, gain: 0.3 });
    });
  }, [schedule]);

  const playPop = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.08, freq: 800, type: "sine", glideTo: 400, gain: 0.6 });
      tone(ctx, start + 0.02, { duration: 0.1, freq: 1200, type: "triangle", gain: 0.3 });
    });
  }, [schedule]);

  const playCheer = useCallback(() => {
    schedule((ctx, start) => {
      // Layered crowd noise with pitched elements
      noise(ctx, start, { duration: 2, gain: 0.7 });
      noise(ctx, start + 0.1, { duration: 1.8, gain: 0.5 });
      // Add some whoops
      tone(ctx, start + 0.2, { duration: 0.3, freq: 400, type: "sine", glideTo: 600, gain: 0.4 });
      tone(ctx, start + 0.5, { duration: 0.3, freq: 500, type: "sine", glideTo: 700, gain: 0.3 });
      tone(ctx, start + 0.9, { duration: 0.4, freq: 450, type: "sine", glideTo: 650, gain: 0.35 });
    });
  }, [schedule]);

  const playTick = useCallback(() => {
    schedule((ctx, start) => {
      tone(ctx, start, { duration: 0.05, freq: 1000, type: "square", gain: 0.5 });
    });
  }, [schedule]);

  const playUrgent = useCallback(() => {
    schedule((ctx, start) => {
      // Urgent warning beeps
      tone(ctx, start, { duration: 0.15, freq: 880, type: "square", gain: 0.7 });
      tone(ctx, start + 0.2, { duration: 0.15, freq: 880, type: "square", gain: 0.7 });
      tone(ctx, start + 0.4, { duration: 0.15, freq: 1100, type: "square", gain: 0.8 });
    });
  }, [schedule]);

  const playReveal = useCallback(() => {
    schedule((ctx, start) => {
      // Dramatic reveal sound
      tone(ctx, start, { duration: 0.2, freq: 300, type: "triangle", glideTo: 500, gain: 0.6 });
      tone(ctx, start + 0.15, { duration: 0.3, freq: 400, type: "triangle", glideTo: 700, gain: 0.7 });
      tone(ctx, start + 0.35, { duration: 0.4, freq: 600, type: "sine", glideTo: 900, gain: 0.8 });
      noise(ctx, start, { duration: 0.2, gain: 0.2 });
    });
  }, [schedule]);

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
    playDrumroll,
    playWhoosh,
    playPop,
    playCheer,
    playTick,
    playUrgent,
    playReveal,
  };
}
