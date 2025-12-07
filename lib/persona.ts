"use client";

import type { PublicRoomState, RoundState } from "@/types/game";

const persona = {
  name: "Lexi the Host",
  avatar: "🎙️",
  tone: {
    lobby: [
      "Lexi here—contestants, take a bow while we warm up the lights!",
      "Studio doors are open. Grab a mic, grab a chair, grab a good alias.",
    ],
    prompt: [
      "Writers, pens up! I want wordplay, whimsy, and maybe a little drama.",
      "This prompt needs sparkle—channel your inner sitcom legend!",
    ],
    vote: [
      "Audience, it’s judgement hour. React like you mean it!",
      "Two answers enter, only one leaves with glory.",
    ],
    results: [
      "Drumroll please… those scores are about to glow.",
      "Lexi loves a comeback story—let’s see if we just got one.",
    ],
    finished: [
      "Curtain down! Take a selfie with the champs.",
      "Season wrap! Someone print those leaderboards for the highlight reel.",
    ],
    default: ["Stay fabulous, folks."],
  },
};

export function getPersonaLine(
  room?: PublicRoomState,
  currentRound?: RoundState,
): string {
  if (!room) {
    return "Warming up the studio feed—hang tight.";
  }

  const lines = persona.tone[room.phase as keyof typeof persona.tone] ??
    persona.tone.default;

  const pick = lines[Math.floor(Math.random() * lines.length)];
  if (room.phase === "results" && currentRound) {
    const topSubmission = [...currentRound.submissions].sort(
      (a, b) => b.voters.length - a.voters.length,
    )[0];
    if (topSubmission) {
      const author =
        room.players.find((player) => player.id === topSubmission.playerId)?.name ??
        "someone mysterious";
      return `${pick} Tonight’s sparkle award goes to ${author}!`;
    }
  }

  if (room.phase === "prompt" && currentRound) {
    return `${pick} Prompt ${room.currentRoundIndex + 1}: ${currentRound.prompt}`;
  }

  return pick;
}

export function getPersonaMeta() {
  return persona;
}
