"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BGM_URL = "/funk-bgm.mp3";

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const audio = new Audio(BGM_URL);
      audio.loop = true;
      audio.volume = 0.45;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
  }, []);

  const start = useCallback(async () => {
    if (playing) return;
    const audio = ensureAudio();
    if (!audio) return;
    try {
      await audio.play();
      setPlaying(true);
    } catch (error) {
      console.warn("Unable to start background music", error);
    }
  }, [ensureAudio, playing]);

  const toggle = useCallback(() => {
    if (playing) {
      stop();
    } else {
      start();
    }
  }, [playing, start, stop]);

  useEffect(() => stop, [stop]);

  return { playing, start, stop, toggle };
}
