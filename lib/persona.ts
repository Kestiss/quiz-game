"use client";

import type { PublicRoomState, RoundState, ReactionEmoji } from "@/types/game";

const persona = {
  name: "Lexi the Host",
  avatar: "🎙️",
  tone: {
    lobby: [
      "Lexi here—contestants, take a bow while we warm up the lights!",
      "Studio doors are open. Grab a mic, grab a chair, grab a good alias.",
      "Welcome, welcome! The stage is set and the prompts are spicy!",
      "Another batch of wordsmiths! Let's see what you've got!",
    ],
    prompt: [
      "Writers, pens up! I want wordplay, whimsy, and maybe a little drama.",
      "This prompt needs sparkle—channel your inner sitcom legend!",
      "Time to get creative! No pressure, just your reputation on the line.",
      "The clock is ticking! Type like your comedy career depends on it!",
      "This one's a crowd-pleaser. Don't let me down!",
    ],
    vote: [
      "Audience, it's judgement hour. React like you mean it!",
      "Two answers enter, only one leaves with glory.",
      "The suspense is killing me! Cast your votes!",
      "Choose wisely—the fate of the universe depends on it. Or just points.",
      "Which answer made you snort? Vote for that one!",
    ],
    results: [
      "Drumroll please… those scores are about to glow.",
      "Lexi loves a comeback story—let's see if we just got one.",
      "The results are in! Someone's about to feel very smug.",
      "Plot twist incoming! Or not. Let's find out!",
    ],
    finished: [
      "Curtain down! Take a selfie with the champs.",
      "Season wrap! Someone print those leaderboards for the highlight reel.",
      "What a show! What a crowd! What a champion!",
      "That's a wrap, folks! Same time next week?",
    ],
    default: ["Stay fabulous, folks."],
  },
  scoreComments: {
    leading: [
      "is absolutely crushing it!",
      "is in the zone!",
      "is making this look easy!",
      "is on fire right now!",
    ],
    trailing: [
      "is saving the best for last, right?",
      "is playing the long game!",
      "is lulling everyone into a false sense of security!",
      "still has a chance to turn this around!",
    ],
    tied: [
      "We've got a dead heat!",
      "It's neck and neck!",
      "Too close to call!",
    ],
  },
  reactionComments: {
    "👏": ["That applause is well deserved!", "The crowd goes wild!"],
    "😂": ["Someone's got jokes!", "The audience is in stitches!"],
    "🔥": ["Things are heating up!", "That's fire!"],
    "😮": ["Jaw. Dropped.", "Nobody saw that coming!"],
  },
  streakComments: {
    2: ["Two in a row! Someone's getting cocky!", "Back-to-back wins!"],
    3: ["A three-peat! We might need to nerf this player!", "HAT TRICK!"],
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

      // Check for streak
      const player = room.players.find((p) => p.id === topSubmission.playerId);
      const streak = player?.streak || 0;

      if (streak >= 3) {
        const streakComment = persona.streakComments[3][Math.floor(Math.random() * persona.streakComments[3].length)];
        return `${pick} ${author} takes it! ${streakComment}`;
      } else if (streak >= 2) {
        const streakComment = persona.streakComments[2][Math.floor(Math.random() * persona.streakComments[2].length)];
        return `${pick} ${author} wins again! ${streakComment}`;
      }

      return `${pick} Tonight's sparkle award goes to ${author}!`;
    }
  }

  if (room.phase === "prompt" && currentRound) {
    return `${pick} Prompt ${room.currentRoundIndex + 1}: ${currentRound.prompt}`;
  }

  // Add score commentary in vote phase
  if (room.phase === "vote") {
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    if (sorted.length >= 2 && sorted[0].score > sorted[1].score) {
      const leader = sorted[0];
      const leadComment = persona.scoreComments.leading[
        Math.floor(Math.random() * persona.scoreComments.leading.length)
      ];
      return `${pick} ${leader.name} ${leadComment}`;
    }
  }

  return pick;
}

export function getReactionComment(emoji: ReactionEmoji): string {
  const comments = persona.reactionComments[emoji];
  return comments[Math.floor(Math.random() * comments.length)];
}

export function getScoreComment(
  room: PublicRoomState,
  playerId: string
): string | null {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const position = sorted.findIndex((p) => p.id === playerId);

  if (position === 0 && sorted.length > 1 && sorted[0].score > sorted[1].score) {
    const comment = persona.scoreComments.leading[
      Math.floor(Math.random() * persona.scoreComments.leading.length)
    ];
    return `${player.name} ${comment}`;
  }

  if (position === sorted.length - 1 && sorted.length > 1) {
    const comment = persona.scoreComments.trailing[
      Math.floor(Math.random() * persona.scoreComments.trailing.length)
    ];
    return `${player.name} ${comment}`;
  }

  return null;
}

export function getPersonaMeta() {
  return persona;
}
