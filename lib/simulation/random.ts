export type SeededRandom = {
  between: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  next: () => number;
  pick: <T>(items: T[]) => T;
};

export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed);

  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  return {
    between: (min, max) => min + next() * (max - min),
    chance: (probability) => next() < probability,
    next,
    pick: (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))],
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
