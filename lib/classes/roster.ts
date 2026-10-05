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

/** A roster entry as everything outside the class form needs it. */
export interface StudentRef {
  id: string;
  name: string;
}

/**
 * A roster entry as stored (`classes.students`): a display name and a random
 * id, nothing else (CLAUDE.md rule 8). `seed` exists only on students who were
 * on a roster before ids did: their variants and task pools were seeded from
 * the name, and keep being, so nothing moved under anyone mid-homework.
 */
export interface RosterStudent extends StudentRef {
  seed?: string;
}

/** What a student's variants and task pool are seeded from (lib/seed/). Never changes, whatever the name becomes. */
export function seedKeyOf(student: Pick<RosterStudent, 'id' | 'seed'>): string {
  return student.seed ?? student.id;
}

/** 12 hex characters: unique enough inside one class, which is all an id has to be. Same shape migration 0009 mints. */
export function newStudentId(random: () => string = () => crypto.randomUUID()): string {
  return random().replace(/-/g, '').slice(0, 12).toLowerCase();
}

/**
 * The students a class is saved with, from an untrusted request: a list of
 * `{ id?, name }`. An entry with an id must be one already stored for this
 * class, and keeps its seed; one without is new and gets an id here. Names
 * are normalized and must differ — students pick themselves by name. Null
 * when the list is not one.
 */
export function cleanStudents(
  input: unknown,
  stored: readonly RosterStudent[],
  newId: () => string = newStudentId
): RosterStudent[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ROSTER_SIZE) return null;
  const byId = new Map(stored.map((student) => [student.id, student]));
  const takenIds = new Set(stored.map((student) => student.id));
  const usedIds = new Set<string>();
  const names = new Set<string>();
  const result: RosterStudent[] = [];
  for (const item of input) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, name } = item as Record<string, unknown>;
    if (typeof name !== 'string') return null;
    const clean = normalizeName(name);
    if (clean === '' || names.has(nameKey(clean))) return null;
    names.add(nameKey(clean));
    if (id !== undefined && id !== null) {
      const existing = typeof id === 'string' ? byId.get(id) : undefined;
      if (!existing || usedIds.has(existing.id)) return null;
      usedIds.add(existing.id);
      result.push({ ...existing, name: clean });
      continue;
    }
    let minted = newId();
    while (takenIds.has(minted)) minted = newId();
    takenIds.add(minted);
    result.push({ id: minted, name: clean });
  }
  return result;
}

/** A class grade from an untrusted request: one of CLASS_GRADES, or null for none. Undefined when invalid. */
export function cleanGrade(input: unknown): number | null | undefined {
  if (input === null || input === undefined || input === '') return null;
  return (CLASS_GRADES as readonly unknown[]).includes(input) ? (input as number) : undefined;
}

/** The roster student a request names by id; null when there is none. */
export function findStudent<T extends StudentRef>(roster: readonly T[], id: string | null | undefined): T | null {
  if (!id) return null;
  return roster.find((student) => student.id === id) ?? null;
}
