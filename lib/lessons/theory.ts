/**
 * A lesson's explanation as a deck of cards (docs/TASKS.md, "Lessons"):
 * students skipped a long page of theory, so it is shown one idea at a time,
 * with «Як думаєш?» cards that ask what a program prints before saying so —
 * guessing first, even wrongly, is what makes the answer stay — and a
 * «Запам'ятай» rule that also stays in the task panel.
 *
 * Pure. The answer to a guess card is the code's real output (CLAUDE.md
 * rule 5): the author marks an option, and that mark is only accepted once a
 * run of the code shows it is what the code prints — in the teacher's browser
 * before a save (`checkGuessRuns`, re-checked by the route handler), and for
 * content/lessons/ by `npm run verify:references`. The student's screen never
 * runs anything.
 */
import { normalizeOutput } from '@/lib/checker/text';
import { parseMarkdown, type Block, type Guess, type GuessProblem, type Inline } from './markdown';

/** XP for finishing a lesson's theory that asks at least one «Як думаєш?» question — the same as an easy task. */
export const THEORY_XP = 10;

/** The blocks between `---` lines; an empty card (two breaks in a row) is dropped. */
export function theoryCards(markdown: string): Block[][] {
  const cards: Block[][] = [[]];
  for (const block of parseMarkdown(markdown)) {
    if (block.kind === 'cardBreak') cards.push([]);
    else cards[cards.length - 1].push(block);
  }
  return cards.filter((card) => card.length > 0);
}

/** Every guess block in reading order. */
export function theoryGuesses(markdown: string): Guess[] {
  return parseMarkdown(markdown).flatMap((block) => (block.kind === 'guess' ? [block.guess] : []));
}

/** A guess a student can answer: well formed, so it has exactly one marked option. */
export function isAnswerable(guess: Guess): guess is Guess & { answer: number } {
  return guess.problems.length === 0 && guess.answer !== null;
}

/** Whether finishing this theory earns THEORY_XP — it asks something. */
export function hasGuessCards(markdown: string): boolean {
  return theoryGuesses(markdown).some(isAnswerable);
}

/** Every «Запам'ятай» line in reading order — what the task panel shows instead of the whole explanation. */
export function rememberLines(markdown: string): Inline[][] {
  return parseMarkdown(markdown).flatMap((block) => (block.kind === 'remember' ? block.lines : []));
}

/** A guess block's shape problems, numbered from 1 in reading order. */
export function guessShapeProblems(markdown: string): { guess: number; problem: GuessProblem }[] {
  return theoryGuesses(markdown).flatMap((guess, index) => guess.problems.map((problem) => ({ guess: index + 1, problem })));
}

/** What running one guess's code produced, as the browser reports it. */
export interface GuessRun {
  code: string;
  stdout: string;
  /** Raised an error or timed out: there is no output to compare. */
  failed: boolean;
}

export type GuessRunProblem = 'notRun' | 'runFailed' | 'answerWrong' | 'ambiguous';

export interface GuessRunReport {
  /** Numbered from 1 in reading order, like guessShapeProblems. */
  guess: number;
  problem: GuessRunProblem;
  /** What the code really printed, when it ran. */
  actual?: string;
}

/**
 * Holds every answerable guess to a run of its own code: the marked option
 * must be what it prints, and no other option may be — a student who picked
 * that one would be told they were wrong while being right. Malformed guesses
 * are guessShapeProblems' to report. Output is compared as `stdout_equals`
 * does by default (normalizeOutput), so spaces at a line's end never matter.
 */
export function checkGuessRuns(markdown: string, runs: readonly GuessRun[]): GuessRunReport[] {
  const byCode = new Map(runs.map((run) => [run.code, run]));
  const reports: GuessRunReport[] = [];
  theoryGuesses(markdown).forEach((guess, index) => {
    if (!isAnswerable(guess)) return;
    const number = index + 1;
    const run = byCode.get(guess.code);
    if (!run) {
      reports.push({ guess: number, problem: 'notRun' });
      return;
    }
    if (run.failed) {
      reports.push({ guess: number, problem: 'runFailed' });
      return;
    }
    const actual = normalizeOutput(run.stdout);
    const matching = guess.options.flatMap((option, i) => (normalizeOutput(option) === actual ? [i] : []));
    if (!matching.includes(guess.answer)) reports.push({ guess: number, problem: 'answerWrong', actual });
    else if (matching.length > 1) reports.push({ guess: number, problem: 'ambiguous', actual });
  });
  return reports;
}

/** The request body's `guessRuns`, checked for shape; anything else is no runs at all. */
export function parseGuessRuns(value: unknown): GuessRun[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  return value.filter(
    (run): run is GuessRun =>
      typeof run === 'object' &&
      run !== null &&
      typeof (run as GuessRun).code === 'string' &&
      typeof (run as GuessRun).stdout === 'string' &&
      typeof (run as GuessRun).failed === 'boolean'
  );
}

/**
 * The order a guess's options are shown in: turned by an amount taken from
 * the code, so the right answer is not always where the author wrote it — and
 * the same on the server's render and the browser's.
 */
export function optionOrder(guess: Guess): number[] {
  const n = guess.options.length;
  let hash = 0;
  for (const char of guess.code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const shift = n === 0 ? 0 : hash % n;
  return guess.options.map((_, i) => (i + shift) % n);
}

export type CardKind = 'idea' | 'guess' | 'remember';

/** What a card is for, shown as its coloured band: a question beats a rule, a rule beats plain explanation. */
export function cardKind(card: readonly Block[]): CardKind {
  if (card.some((block) => block.kind === 'guess' && isAnswerable(block.guess))) return 'guess';
  if (card.some((block) => block.kind === 'remember')) return 'remember';
  return 'idea';
}

const TERM_DASH = /\s+—\s+/;
const MAX_TERM_LENGTH = 40;

/**
 * A line written "`code` — meaning" (an em dash between spaces): the term and
 * what it means. A list of these is drawn as term tiles, and a «Запам'ятай»
 * rule of this shape becomes a tile the student flips to test themselves.
 * Null for anything else — it stays an ordinary line.
 */
export function splitTerm(line: readonly Inline[]): { term: Inline[]; meaning: Inline[] } | null {
  const at = line.findIndex((node) => node.kind === 'text' && TERM_DASH.test(node.text));
  if (at < 0) return null;
  const node = line[at] as Extract<Inline, { kind: 'text' }>;
  const dash = TERM_DASH.exec(node.text)!;
  const before = node.text.slice(0, dash.index);
  const after = node.text.slice(dash.index + dash[0].length);
  const term: Inline[] = [...line.slice(0, at), ...(before ? [{ kind: 'text' as const, text: before }] : [])];
  const meaning: Inline[] = [...(after ? [{ kind: 'text' as const, text: after }] : []), ...line.slice(at + 1)];
  if (!term.some((part) => part.kind === 'code') || meaning.length === 0) return null;
  const termLength = term.reduce((sum, part) => sum + (part.kind === 'text' || part.kind === 'code' ? part.text.length : 0), 0);
  return termLength <= MAX_TERM_LENGTH ? { term, meaning } : null;
}
