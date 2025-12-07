const PROMPTS: Record<string, string[]> = {
  silly: [
    "A terrible theme for a surprise birthday party",
    "The weirdest thing to say to your neighbor",
    "An invention that nobody asked for",
    "Add a plot twist to a fairy tale",
    "The secret ingredient in grandma's famous soup",
    "A slogan for the world's worst airline",
    "Something you should never yell in a crowded elevator",
    "A rejected motto for a superhero",
    "Describe the internet in four words",
    "What aliens really think of Earth",
    "The sequel to a children's book that nobody expected",
    "A new holiday that deserves a day off",
    "Worst message to find in a fortune cookie",
    "Describe Mondays without using the word Monday",
    "A questionable use for a smart fridge",
    "The worst name for a pet goldfish",
    "Something you shouldn't say during a job interview",
    "A rejected Olympic sport",
    "The world's least exciting superpower",
    "A terrible excuse for being late",
  ],
  popCulture: [
    "A deleted scene from your favorite movie",
    "A TV show crossover that would be chaos",
    "The worst song to play at a wedding",
    "A rejected band name",
    "What a famous celebrity says in their sleep",
    "A spinoff nobody asked for",
    "The worst remix of a classic song",
    "A terrible idea for a theme park ride",
    "What your favorite villain says at their therapy session",
    "A rejected tagline for a blockbuster movie",
  ],
  darkHumor: [
    "What Death says on their day off",
    "A greeting card for your worst enemy",
    "The fine print on a deal with the devil",
    "A review of the afterlife",
    "Something a ghost would complain about",
    "The worst thing to discover in your ancestry test",
    "A warning label for humanity",
    "What aliens say after visiting Earth",
    "The most honest autopsy report",
    "A rejected entry in the dictionary of life",
  ],
  workplace: [
    "A passive-aggressive email subject line",
    "What your coworker really means by 'let's circle back'",
    "The worst team-building exercise",
    "An honest out-of-office reply",
    "What your boss thinks during meetings",
    "A terrible suggestion for casual Friday",
    "The unwritten rule of every office",
    "What the coffee machine would say if it could talk",
    "A rejected slogan for your company",
    "The most awkward thing to say in a Zoom call",
  ],
  relationships: [
    "The worst pickup line ever",
    "A red flag on a dating profile",
    "What your pet really thinks of you",
    "The worst advice from your parents",
    "Something you should never text your ex",
    "A terrible first date activity",
    "What your houseplant would say if it could talk",
    "The most awkward conversation starter",
    "A warning sign your relationship is doomed",
    "What your phone knows about you",
  ],
  absurd: [
    "If pizza could speak, it would say...",
    "The secret life of traffic cones",
    "What clouds argue about",
    "A rejected law of physics",
    "The internal monologue of a shopping cart",
    "What socks do when you're not looking",
    "A conversation between two vending machines",
    "The autobiography of a rubber duck",
    "What doorknobs gossip about",
    "A review of Earth from a visiting asteroid",
  ],
};

const ALL_PROMPTS = Object.values(PROMPTS).flat();

// Re-export PromptCategory from types for convenience
export type { PromptCategory } from "@/types/game";
import type { PromptCategory } from "@/types/game";

export const PROMPT_CATEGORIES: PromptCategory[] = ["silly", "popCulture", "darkHumor", "workplace", "relationships", "absurd"];

export function pickPrompts(count: number, categories?: PromptCategory[]): string[] {
  let pool: string[];

  if (categories && categories.length > 0) {
    pool = categories.flatMap((cat) => PROMPTS[cat] || []);
  } else {
    pool = [...ALL_PROMPTS];
  }

  const picks: string[] = [];

  while (picks.length < count) {
    if (pool.length === 0) {
      pool = categories && categories.length > 0
        ? categories.flatMap((cat) => PROMPTS[cat] || [])
        : [...ALL_PROMPTS];
      pool = shuffle(pool);
    }

    const index = Math.floor(Math.random() * pool.length);
    const prompt = pool.splice(index, 1)[0];
    if (!picks.includes(prompt)) {
      picks.push(prompt);
    }
  }

  return picks.slice(0, count);
}

export function pickPromptsWithCustom(
  count: number,
  customPrompts: string[],
  categories?: PromptCategory[]
): string[] {
  // Custom prompts go first
  const custom = customPrompts.slice(0, count);
  const remaining = count - custom.length;

  if (remaining <= 0) {
    return shuffle(custom).slice(0, count);
  }

  const regular = pickPrompts(remaining, categories);
  return shuffle([...custom, ...regular]);
}

export function getPromptsByCategory(category: PromptCategory): string[] {
  return [...PROMPTS[category]];
}

export function getAllPrompts(): string[] {
  return [...ALL_PROMPTS];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Safety quip for players who don't submit
export const SAFETY_QUIPS = [
  "I was too busy being fabulous",
  "My dog ate my answer",
  "Error 404: Wit not found",
  "I plead the fifth",
  "*crickets*",
  "Ask me again later",
  "Loading... please wait",
  "This answer is still buffering",
  "I panicked and this happened",
  "My creativity took a coffee break",
];

export function getRandomSafetyQuip(): string {
  return SAFETY_QUIPS[Math.floor(Math.random() * SAFETY_QUIPS.length)];
}
