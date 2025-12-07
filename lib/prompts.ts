const PROMPTS = [
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
];

export function pickPrompts(count: number): string[] {
  const pool = [...PROMPTS];
  const picks: string[] = [];

  while (picks.length < count) {
    if (pool.length === 0) {
      picks.push(...shuffle([...PROMPTS]));
      continue;
    }

    const index = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }

  return picks.slice(0, count);
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
