/**
 * "Similar code" (docs/HOMEWORK.md, section 5, threat 1): passing programs by
 * different students on the same task that are the same once what copying
 * changes cheaply is set aside — comments, blank lines, spacing, and the names
 * of variables. Keywords, built-ins, modules, attribute names, numbers and
 * strings stay as written, so two programs only match when their structure
 * and their text both do. A fact for the teacher, never a verdict: on a short
 * task two honest students can write the same program, so programs under
 * `MIN_TOKENS` are never compared.
 *
 * Pure.
 */
import { tokenize, type Token } from './python-tokens';

/** Shorter programs are left out: a three-line answer can match by honest coincidence. */
export const MIN_TOKENS = 25;

const KEEP = new Set([
  // keywords
  'False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
  'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  // built-ins a lesson uses
  'print', 'input', 'int', 'float', 'str', 'bool', 'range', 'len', 'abs', 'round', 'min', 'max', 'sum', 'list',
  'dict', 'set', 'tuple', 'sorted', 'reversed', 'enumerate', 'zip', 'map', 'filter', 'any', 'all', 'type',
  'isinstance', 'chr', 'ord', 'pow', 'divmod',
  // modules the curriculum imports
  'turtle', 'random', 'math', 'time', 'robot'
]);

/** f-string braces hold expressions with variable names in them; their contents are not compared. */
function fstringShape(text: string): string {
  return text.replace(/\{[^{}]*\}/g, '{}');
}

/**
 * The program as a comparable string, or null when it is too short to
 * compare. Variables become v1, v2… in order of first use.
 */
export function structureKey(code: string): string | null {
  const tokens = tokenize(code);
  const names = new Map<string, string>();
  const out: string[] = [];
  let significant = 0;
  tokens.forEach((token: Token, index) => {
    if (token.kind === 'newline') {
      out.push(`⏎${token.level}`);
      return;
    }
    significant += 1;
    if (token.kind === 'name') {
      const afterDot = index > 0 && tokens[index - 1].kind === 'op' && (tokens[index - 1] as { text: string }).text === '.';
      if (afterDot || KEEP.has(token.text)) {
        out.push(token.text);
      } else {
        if (!names.has(token.text)) names.set(token.text, `v${names.size + 1}`);
        out.push(names.get(token.text)!);
      }
      return;
    }
    out.push(token.kind === 'string' && token.fstring ? fstringShape(token.text) : token.text);
  });
  return significant >= MIN_TOKENS ? out.join(' ') : null;
}

export interface CodeSubmission {
  studentId: string;
  studentName: string;
  taskId: string;
  taskTitle: string;
  code: string;
  createdAt: string;
}

export interface SimilarGroup {
  taskId: string;
  taskTitle: string;
  /** Two or more, alphabetical by name. */
  studentIds: string[];
  /** The same students' names, in the same order. */
  studentNames: string[];
}

/**
 * Groups of students whose latest passing program on a task has the same
 * structure. Pass passing submissions only — an unfinished starter shared by
 * everyone is not a fact about anyone.
 */
export function findSimilarCode(submissions: readonly CodeSubmission[]): SimilarGroup[] {
  const latest = new Map<string, CodeSubmission>();
  for (const submission of submissions) {
    const key = `${submission.taskId}|${submission.studentId}`;
    const current = latest.get(key);
    if (!current || submission.createdAt > current.createdAt) latest.set(key, submission);
  }

  const groups = new Map<string, { taskId: string; taskTitle: string; names: Map<string, string> }>();
  for (const submission of latest.values()) {
    const shape = structureKey(submission.code);
    if (shape === null) continue;
    const key = `${submission.taskId}|${shape}`;
    const group = groups.get(key) ?? { taskId: submission.taskId, taskTitle: submission.taskTitle, names: new Map() };
    group.names.set(submission.studentId, submission.studentName);
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.names.size >= 2)
    .map((group) => {
      const students = [...group.names].sort(([, a], [, b]) => a.localeCompare(b, 'uk'));
      return {
        taskId: group.taskId,
        taskTitle: group.taskTitle,
        studentIds: students.map(([id]) => id),
        studentNames: students.map(([, name]) => name)
      };
    });
}
