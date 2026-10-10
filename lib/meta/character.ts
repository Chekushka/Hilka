/**
 * The practice character: what XP is for (docs/TASKS.md, "Meta Layer").
 * XP adds up to levels, and each level unlocks something to wear — a colour,
 * eyes, a hat, a thing to carry. Unlocks, never purchases: XP is derived from
 * completed tasks and never spent, so a progress-code merge (a union of
 * slugs) still needs no rule of its own, and nothing can be lost.
 *
 * Pure. The look a student picked is stored beside their completed tasks
 * (lib/practice/progress.ts); everything else here is derived from XP.
 */

/** XP needed to reach each level: index 0 is level 1. The first levels come fast — the first reward must. */
export const LEVEL_XP = [0, 30, 80, 150, 250, 400, 600, 850, 1150, 1500, 1900, 2350, 2850, 3400] as const;

export const MAX_LEVEL = LEVEL_XP.length;

export type CharacterSlot = 'body' | 'eyes' | 'head' | 'extra';

export const CHARACTER_SLOTS: readonly CharacterSlot[] = ['body', 'eyes', 'head', 'extra'];

export interface CharacterItem {
  id: string;
  slot: CharacterSlot;
  /** The level that unlocks it. */
  level: number;
}

/**
 * Everything the character can wear, in the order it is offered. Ids are
 * stored in progress, so an id is never renamed or reused — a retired item
 * is removed, and a look naming it falls back to the slot's default.
 */
export const CHARACTER_ITEMS: readonly CharacterItem[] = [
  { id: 'leaf', slot: 'body', level: 1 },
  { id: 'sky', slot: 'body', level: 2 },
  { id: 'honey', slot: 'body', level: 4 },
  { id: 'rose', slot: 'body', level: 6 },
  { id: 'violet', slot: 'body', level: 8 },
  { id: 'night', slot: 'body', level: 11 },

  { id: 'dots', slot: 'eyes', level: 1 },
  { id: 'happy', slot: 'eyes', level: 3 },
  { id: 'glasses', slot: 'eyes', level: 5 },
  { id: 'shades', slot: 'eyes', level: 9 },
  { id: 'stars', slot: 'eyes', level: 13 },

  { id: 'sprout', slot: 'head', level: 1 },
  { id: 'none', slot: 'head', level: 1 },
  { id: 'cap', slot: 'head', level: 2 },
  { id: 'beanie', slot: 'head', level: 4 },
  { id: 'headphones', slot: 'head', level: 7 },
  { id: 'flower', slot: 'head', level: 10 },
  { id: 'crown', slot: 'head', level: 14 },

  { id: 'none', slot: 'extra', level: 1 },
  { id: 'scarf', slot: 'extra', level: 3 },
  { id: 'book', slot: 'extra', level: 6 },
  { id: 'laptop', slot: 'extra', level: 8 },
  { id: 'python', slot: 'extra', level: 12 }
];

export type CharacterLook = Record<CharacterSlot, string>;

export const DEFAULT_LOOK: CharacterLook = { body: 'leaf', eyes: 'dots', head: 'sprout', extra: 'none' };

export interface LevelProgress {
  level: number;
  /** XP the current level started at. */
  levelXp: number;
  /** XP the next level starts at; null at the top level. */
  nextXp: number | null;
}

export function levelProgress(xp: number): LevelProgress {
  let index = 0;
  while (index + 1 < LEVEL_XP.length && xp >= LEVEL_XP[index + 1]) index += 1;
  return { level: index + 1, levelXp: LEVEL_XP[index], nextXp: LEVEL_XP[index + 1] ?? null };
}

export function levelForXp(xp: number): number {
  return levelProgress(xp).level;
}

export function isUnlocked(item: CharacterItem, level: number): boolean {
  return item.level <= level;
}

export function findItem(slot: CharacterSlot, id: string): CharacterItem | undefined {
  return CHARACTER_ITEMS.find((item) => item.slot === slot && item.id === id);
}

/** What unlocks on reaching each level above `fromLevel` up to `toLevel` — what a pass that levelled up just earned. */
export function itemsUnlockedBetween(fromLevel: number, toLevel: number): CharacterItem[] {
  return CHARACTER_ITEMS.filter((item) => item.level > fromLevel && item.level <= toLevel);
}

/** The nearest level above `level` that unlocks something, and what; null when everything is open. */
export function nextUnlock(level: number): { level: number; items: CharacterItem[] } | null {
  const ahead = CHARACTER_ITEMS.filter((item) => item.level > level);
  if (ahead.length === 0) return null;
  const nextLevel = Math.min(...ahead.map((item) => item.level));
  return { level: nextLevel, items: ahead.filter((item) => item.level === nextLevel) };
}

/**
 * The look to draw: the stored choice, slot by slot, where it names an item
 * that exists and is unlocked at `level`; the default everywhere else. A
 * level can fall (a task removed from the course stops earning XP), and then
 * an item above it is not worn — the choice is kept, and returns with the level.
 */
export function resolveLook(look: Partial<Record<string, unknown>> | undefined, level: number): CharacterLook {
  const resolved = { ...DEFAULT_LOOK };
  if (!look) return resolved;
  for (const slot of CHARACTER_SLOTS) {
    const id = look[slot];
    if (typeof id !== 'string') continue;
    const item = findItem(slot, id);
    if (item && isUnlocked(item, level)) resolved[slot] = id;
  }
  return resolved;
}

const MAX_ID_LENGTH = 40;

/**
 * Guards a stored look: an object of slot → short string, nothing else. Ids
 * are not checked against the catalogue here — an item retired later must not
 * make a whole saved progress invalid; `resolveLook` ignores what it does not know.
 */
export function isValidStoredLook(value: unknown): value is Partial<CharacterLook> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.every(
    ([key, id]) =>
      (CHARACTER_SLOTS as readonly string[]).includes(key) &&
      typeof id === 'string' &&
      id.length > 0 &&
      id.length <= MAX_ID_LENGTH
  );
}
