/**
 * Two pictures a lesson's theory can draw instead of saying in words
 * (project owner: more visual theory). Both are fenced blocks in the
 * explanation's Markdown, parsed here, drawn by components/lesson/TheoryVisuals.tsx.
 * Pure — no DOM, no runner.
 *
 * **```memory** — what the computer keeps in its memory, line by line. Code
 * that runs top to bottom (no blocks, no `input()`), and after a line, one
 * `> name = value` line per variable that line changes:
 *
 *     ```memory
 *     x = 5
 *     > x = 5
 *     y = x + 2
 *     > y = 7
 *     x = x * 2
 *     > x = 10
 *     ```
 *
 * The student steps through it and sees each variable as a labelled box, the
 * one that just changed lit up with its old value crossed out. The values are
 * the author's, so like a «Як думаєш?» answer they are only accepted once a
 * run proves them (CLAUDE.md rule 5): every step's code so far is run, and
 * `repr()` of each variable must equal `repr()` of the value written — so
 * `10` and `10.0`, `5` and `"5"` are told apart — and no variable may appear
 * that the block does not show (`checkMemoryRuns`).
 *
 * **```flow** — a flowchart of a branch or a loop. Display only: it claims
 * nothing about what code prints, so nothing needs a run.
 *
 *     ```flow
 *     ? t > 20
 *     так: print("Тепло")
 *     ні: print("Прохолодно")
 *     ```
 *
 *     ```flow
 *     поки n > 0
 *     повтор: print(n)
 *     повтор: n = n - 1
 *     далі: print("Старт!")
 *     ```
 */
import { parseMarkdown } from './markdown';

// ---------- memory ----------

export type MemoryProblem = 'noSteps' | 'notStraightLine' | 'readsInput' | 'badChange' | 'changeBeforeCode';

export interface MemoryChange {
  name: string;
  /** A Python literal, as written. */
  value: string;
}

export interface MemoryStep {
  line: string;
  changes: MemoryChange[];
}

export interface Memory {
  steps: MemoryStep[];
  problems: MemoryProblem[];
}

/** One variable's box after a step: its value, and what it held before if this step changed it. */
export interface MemoryBox {
  name: string;
  value: string;
  changed: boolean;
  previous: string | null;
}

const CHANGE = /^>\s*([A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*)\s*=\s*(.+?)\s*$/;
/** Literals only: a number, a quoted string with no escapes, True, False, None. */
const LITERAL = /^(-?\d+(\.\d+)?|"[^"\\]*"|'[^'\\]*'|True|False|None)$/;

export function parseMemory(text: string): Memory {
  const steps: MemoryStep[] = [];
  const problems = new Set<MemoryProblem>();
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') continue;
    if (line.trimStart().startsWith('>')) {
      const match = CHANGE.exec(line.trim());
      if (!match || !LITERAL.test(match[2])) problems.add('badChange');
      else if (steps.length === 0) problems.add('changeBeforeCode');
      else steps[steps.length - 1].changes.push({ name: match[1], value: match[2] });
      continue;
    }
    // Top to bottom only: a block would need a step per pass, which this picture does not draw.
    if (/^\s/.test(line) || /:\s*(#.*)?$/.test(line)) problems.add('notStraightLine');
    if (/\binput\s*\(/.test(line)) problems.add('readsInput');
    steps.push({ line, changes: [] });
  }
  if (steps.length === 0) problems.add('noSteps');
  return { steps, problems: [...problems] };
}

/** The boxes after `step` (0-based): every variable met so far, in the order it first appeared. */
export function memoryBoxes(memory: Memory, step: number): MemoryBox[] {
  const boxes = new Map<string, MemoryBox>();
  memory.steps.slice(0, step + 1).forEach((current, index) => {
    for (const box of boxes.values()) {
      box.changed = false;
      box.previous = null;
    }
    for (const change of current.changes) {
      const before = boxes.get(change.name);
      boxes.set(change.name, {
        name: change.name,
        value: change.value,
        changed: index === step,
        previous: before ? before.value : null
      });
    }
  });
  return [...boxes.values()];
}

/** Every memory block in an explanation, in reading order. */
export function theoryMemories(markdown: string): Memory[] {
  return parseMarkdown(markdown).flatMap((block) =>
    block.kind === 'code' && block.lang.toLowerCase() === 'memory' ? [parseMemory(block.text)] : []
  );
}

export function memoryShapeProblems(markdown: string): { memory: number; problem: MemoryProblem }[] {
  return theoryMemories(markdown).flatMap((memory, index) => memory.problems.map((problem) => ({ memory: index + 1, problem })));
}

/** One run a memory block needs: a step's code so far, and the checks of every box it should show. */
export interface MemoryRunRequest {
  code: string;
  exprs: string[];
}

const valueExpr = (box: { name: string; value: string }) => `repr(${box.name}) == repr(${box.value})`;

/** For a well-formed block, one run per step. */
export function memoryRunRequests(memory: Memory): MemoryRunRequest[] {
  if (memory.problems.length > 0) return [];
  return memory.steps.map((_, step) => ({
    code: memory.steps
      .slice(0, step + 1)
      .map((current) => current.line)
      .join('\n'),
    exprs: memoryBoxes(memory, step).map(valueExpr)
  }));
}

/** What one such run produced, as the browser reports it. */
export interface MemoryRun {
  code: string;
  /** Each expression's result, keyed by its own text (RunResult.exprResults). */
  exprResults: Record<string, boolean>;
  /** Every variable the program holds afterwards (the keys of RunResult.vars). */
  names: string[];
  failed: boolean;
}

export type MemoryRunProblem = 'notRun' | 'runFailed' | 'valueWrong' | 'unlisted';

export interface MemoryRunReport {
  /** Numbered from 1 in reading order. */
  memory: number;
  /** Numbered from 1. */
  step: number;
  problem: MemoryRunProblem;
  /** The variable concerned. */
  name?: string;
}

export function checkMemoryRuns(markdown: string, runs: readonly MemoryRun[]): MemoryRunReport[] {
  const byCode = new Map(runs.map((run) => [run.code, run]));
  const reports: MemoryRunReport[] = [];
  theoryMemories(markdown).forEach((memory, index) => {
    const requests = memoryRunRequests(memory);
    for (const [step, request] of requests.entries()) {
      const where = { memory: index + 1, step: step + 1 };
      const run = byCode.get(request.code);
      if (!run) {
        reports.push({ ...where, problem: 'notRun' });
        return;
      }
      if (run.failed) {
        reports.push({ ...where, problem: 'runFailed' });
        return;
      }
      const boxes = memoryBoxes(memory, step);
      const wrong = boxes.find((box) => run.exprResults[valueExpr(box)] !== true);
      if (wrong) {
        reports.push({ ...where, problem: 'valueWrong', name: wrong.name });
        return;
      }
      const shown = new Set(boxes.map((box) => box.name));
      const unlisted = run.names.find((name) => !shown.has(name));
      if (unlisted) {
        reports.push({ ...where, problem: 'unlisted', name: unlisted });
        return;
      }
    }
  });
  return reports;
}

/** The request body's `memoryRuns`, checked for shape; anything else is no runs at all. */
export function parseMemoryRuns(value: unknown): MemoryRun[] {
  if (!Array.isArray(value) || value.length > 300) return [];
  return value.filter(
    (run): run is MemoryRun =>
      typeof run === 'object' &&
      run !== null &&
      typeof (run as MemoryRun).code === 'string' &&
      typeof (run as MemoryRun).failed === 'boolean' &&
      Array.isArray((run as MemoryRun).names) &&
      (run as MemoryRun).names.every((name) => typeof name === 'string') &&
      typeof (run as MemoryRun).exprResults === 'object' &&
      (run as MemoryRun).exprResults !== null &&
      Object.values((run as MemoryRun).exprResults).every((result) => typeof result === 'boolean')
  );
}

// ---------- flow ----------

export type FlowProblem = 'noCondition' | 'noBranch' | 'unknownLine';

export type Flow =
  | { kind: 'if'; condition: string; yes: string[]; no: string[]; problems: FlowProblem[] }
  | { kind: 'while'; condition: string; body: string[]; after: string[]; problems: FlowProblem[] };

const FLOW_LINE = /^(так|ні|повтор|далі)\s*:\s*(.*)$/i;

export function parseFlow(text: string): Flow {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const head = lines[0] ?? '';
  const problems = new Set<FlowProblem>();
  const loop = /^поки\s+/i.test(head);
  const condition = loop ? head.replace(/^поки\s+/i, '').trim() : head.startsWith('?') ? head.slice(1).trim() : '';
  if (condition === '') problems.add('noCondition');

  const sections: Record<string, string[]> = { так: [], ні: [], повтор: [], далі: [] };
  for (const line of lines.slice(1)) {
    const match = FLOW_LINE.exec(line);
    const section = match?.[1].toLowerCase();
    // A loop's lines are повтор/далі, a branch's так/ні; anything else is a typo worth naming.
    if (!match || !section || (loop ? !['повтор', 'далі'].includes(section) : !['так', 'ні'].includes(section))) {
      problems.add('unknownLine');
      continue;
    }
    if (match[2].trim() !== '') sections[section].push(match[2].trim());
  }

  if (loop) {
    if (sections['повтор'].length === 0) problems.add('noBranch');
    return { kind: 'while', condition, body: sections['повтор'], after: sections['далі'], problems: [...problems] };
  }
  if (sections['так'].length === 0) problems.add('noBranch');
  return { kind: 'if', condition, yes: sections['так'], no: sections['ні'], problems: [...problems] };
}

export function flowShapeProblems(markdown: string): { flow: number; problem: FlowProblem }[] {
  return parseMarkdown(markdown)
    .flatMap((block) => (block.kind === 'code' && block.lang.toLowerCase() === 'flow' ? [parseFlow(block.text)] : []))
    .flatMap((flow, index) => flow.problems.map((problem) => ({ flow: index + 1, problem })));
}
