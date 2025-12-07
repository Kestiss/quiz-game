"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

interface SpeechApi {
  speak: (text: string) => void;
  cancel: () => void;
  supported: boolean;
}

export function useSpeech(enabled: boolean): SpeechApi {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [supported, setSupported] = useState(false);
  const updateSupported = useEffectEvent((value: boolean) => {
    setSupported(value);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      updateSupported(true);
    } else {
      updateSupported(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (!synthRef.current || !supported) return;
    synthRef.current.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !supported || !synthRef.current || !text.trim()) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      cancel();
      synthRef.current.speak(utterance);
    },
    [cancel, enabled, supported],
  );

  useEffect(() => cancel, [cancel]);

  return { speak, cancel, supported };
}
