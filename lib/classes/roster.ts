/**
 * A class roster is a plain list of display names (CLAUDE.md rule 8 — never
 * a students table). Pure helpers for editing one: reading names out of
 * whatever a teacher pastes, keeping the list free of repeats, sorting it the
 * Ukrainian way, and checking a rename before the server moves a student's
 * results to the new spelling. Shared by the class form and the class routes,
 * so the browser and the server agree on what a name is.
 */

export const MAX_NAME_LENGTH = 60;
export const MAX_ROSTER_SIZE = 60;

/** Grades a class can be tagged with — the curriculum's (docs/CURRICULUM.md). */
export const CLASS_GRADES = [7, 8, 9] as const;

const NUMBERING = /^(?:№\s*)?\d{1,3}\s*[.)\-–—:]?\s+/u;

/** One name as it is stored: trimmed, inner whitespace collapsed, no longer than the limit. */
export function normalizeName(raw: string): string {
  return raw.replace(/\s+/gu, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
}

/**
 * A typed or pasted name: normalized, and a list number in front dropped
 * («1. Петренко Іван», «12) Оля» — class lists are copied out of journals
 * numbered). Only for new input: a name already stored is never rewritten.
 */
export function readName(raw: string): string {
  return normalizeName(normalizeName(raw).replace(NUMBERING, ''));
}

/** The comparison key: two names that differ only in case or spacing are the same student. */
export function nameKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase('uk');
}

/**
 * Every name in pasted text. One per line, or several on a line separated by
 * commas or semicolons. A line from a spreadsheet (cells separated by tabs) is
 * one student, its cells joined — «Петренко⇥Іван» — with a number-only cell
 * (the row number) left out.
 */
export function parseNames(text: string): string[] {
  const names: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    if (line.includes('\t')) {
      const cells = line
        .split('\t')
        .map((cell) => cell.trim())
        .filter((cell) => cell !== '' && !/^\d+[.)]?$/u.test(cell));
      names.push(readName(cells.join(' ')));
    } else {
      names.push(...line.split(/[,;]/u).map(readName));
    }
  }
  return names.filter((name) => name !== '');
}

export interface AddResult {
  roster: string[];
  added: string[];
  /** Names already on the roster, or repeated in what was pasted. */
  skipped: string[];
}

/** Appends names at the end, skipping any the roster already has. */
export function addNames(roster: readonly string[], names: readonly string[]): AddResult {
  const keys = new Set(roster.map(nameKey));
  const added: string[] = [];
  const skipped: string[] = [];
  for (const raw of names) {
    const name = normalizeName(raw);
    if (name === '') continue;
    const key = nameKey(name);
    if (keys.has(key)) {
      skipped.push(name);
      continue;
    }
    keys.add(key);
    added.push(name);
  }
  return { roster: [...roster, ...added], added, skipped };
}

/** Alphabetical, the Ukrainian way (є after е, ї after і, ґ after г). */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'uk', { sensitivity: 'base' });
}

export function sortRoster(roster: readonly string[]): string[] {
  return [...roster].sort(compareNames);
}

/**
 * A roster from an untrusted request: every entry a non-empty string, stored
 * normalized, no repeats, within the size limits. Null when it is not one.
 */
export function cleanRoster(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (!input.every((name) => typeof name === 'string')) return null;
  const names = (input as string[]).map(normalizeName);
  if (names.some((name) => name === '')) return null;
  const { roster, skipped } = addNames([], names);
  if (skipped.length > 0 || roster.length > MAX_ROSTER_SIZE) return null;
  return roster;
}

/** A class grade from an untrusted request: one of CLASS_GRADES, or null for none. Undefined when invalid. */
export function cleanGrade(input: unknown): number | null | undefined {
  if (input === null || input === undefined || input === '') return null;
  return (CLASS_GRADES as readonly unknown[]).includes(input) ? (input as number) : undefined;
}

export interface Rename {
  from: string;
  to: string;
}

/**
 * Renames the server may carry out: each moves a student's results from a
 * name that was on the roster to one that is on it now. A name may not be
 * renamed into one the old roster already had — that would merge two
 * students' work — nor be renamed twice, nor stay on the roster under its old
 * spelling as well. Null when any rename breaks those rules.
 */
export function cleanRenames(input: unknown, before: readonly string[], after: readonly string[]): Rename[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input)) return null;
  const beforeKeys = new Set(before);
  const afterKeys = new Set(after);
  const froms = new Set<string>();
  const tos = new Set<string>();
  const renames: Rename[] = [];
  for (const item of input) {
    if (typeof item !== 'object' || item === null) return null;
    const { from, to } = item as Record<string, unknown>;
    if (typeof from !== 'string' || typeof to !== 'string') return null;
    const target = normalizeName(to);
    if (from === target) continue;
    if (!beforeKeys.has(from) || afterKeys.has(from)) return null;
    if (!afterKeys.has(target)) return null;
    if (before.some((name) => name !== from && nameKey(name) === nameKey(target))) return null;
    if (froms.has(from) || tos.has(target)) return null;
    froms.add(from);
    tos.add(target);
    renames.push({ from, to: target });
  }
  return renames;
}
