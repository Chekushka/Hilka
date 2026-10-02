/**
 * The authoring UI's visual check builder (docs/TASK_SCHEMA.md, "Checks"):
 * which kinds a task type may use, a sensible starting check per kind, and a
 * text ⇄ value mapping per field. Pure, so every form that carries checks
 * shares one mapping, and the builder stays a thin view over it.
 *
 * Checks stay data (CLAUDE.md rule 1): the builder only ever produces the
 * same JSON a teacher could type by hand. A check whose fields the builder
 * cannot show (shape_contains's segments, shape_props's bbox/colors) is not
 * squeezed into a form — `unsupportedKeys` names what is missing, and the
 * builder edits that one check as raw JSON instead.
 */
import type { Check, ShapeNormalization } from '@/lib/checker';
import type { RunCase, TaskType } from './types';

export type CheckKind = Check['kind'];

export type FieldType =
  /** One-line string. */
  | 'text'
  /** Multi-line string (expected output). */
  | 'multiline'
  /** Python source, monospace. */
  | 'code'
  /** A required number. */
  | 'number'
  /** A number that may be left empty (the key is then omitted). */
  | 'optionalNumber'
  /** "0, 2, 3" ⇄ number[]. */
  | 'numberList'
  /** "for, while" ⇄ string[]; empty omits the key when optional. */
  | 'stringList'
  | 'bool'
  /** One of `options`; '' omits the key. */
  | 'select'
  /** Any JSON value; text that is not JSON is taken as a string. */
  | 'json'
  /** number_close.which: 'last' | 'first' | a line index. */
  | 'which'
  /** "4" or "4–6": a number or an inclusive range. */
  | 'range'
  /** shape_equals.normalize: a set of ShapeNormalization. */
  | 'normalizeSet'
  /** '' (either) | 'true' | 'false'. */
  | 'triBool';

export interface FieldSpec {
  key: string;
  type: FieldType;
  /** For 'select'. */
  options?: readonly string[];
  /** The key is always written, even when empty. */
  required?: boolean;
  /** For 'range': whether a single number is kept as a number (segmentCount) or widened to [n, n] (totalLength). */
  pairOnly?: boolean;
}

export const CHECK_FIELDS: Record<CheckKind, readonly FieldSpec[]> = {
  choice_equals: [{ key: 'indices', type: 'numberList', required: true }],
  order_equals: [
    { key: 'lines', type: 'numberList', required: true },
    { key: 'checkIndent', type: 'bool' },
    { key: 'indents', type: 'numberList' }
  ],
  text_equals: [
    { key: 'value', type: 'text', required: true },
    { key: 'normalize', type: 'select', options: ['trim', 'loose'] }
  ],
  stdout_equals: [
    { key: 'value', type: 'multiline', required: true },
    { key: 'trim', type: 'bool' }
  ],
  stdout_contains: [
    { key: 'value', type: 'text', required: true },
    { key: 'ignoreCase', type: 'bool' }
  ],
  last_line_equals: [
    { key: 'value', type: 'text', required: true },
    { key: 'normalize', type: 'select', options: ['trim', 'loose'] }
  ],
  number_close: [
    { key: 'value', type: 'number', required: true },
    { key: 'tol', type: 'number', required: true },
    { key: 'which', type: 'which' }
  ],
  numbers_equal: [
    { key: 'values', type: 'numberList', required: true },
    { key: 'tol', type: 'number', required: true }
  ],
  matches_reference: [
    { key: 'compare', type: 'select', options: ['numbers', 'last_line'], required: true },
    { key: 'tol', type: 'optionalNumber' },
    { key: 'normalize', type: 'select', options: ['trim', 'loose'] }
  ],
  var_equals: [
    { key: 'name', type: 'text', required: true },
    { key: 'value', type: 'json', required: true }
  ],
  expr: [{ key: 'python', type: 'code', required: true }],
  shape_equals: [
    { key: 'normalize', type: 'normalizeSet' },
    { key: 'tolerance', type: 'optionalNumber' }
  ],
  shape_contains: [{ key: 'tolerance', type: 'optionalNumber' }],
  shape_props: [
    { key: 'closed', type: 'triBool' },
    { key: 'segmentCount', type: 'range' },
    { key: 'totalLength', type: 'range', pairOnly: true }
  ],
  uses: [
    { key: 'all', type: 'stringList' },
    { key: 'any', type: 'stringList' }
  ],
  forbids: [{ key: 'names', type: 'stringList', required: true }],
  // Nothing to fill in: the world is the task's own (payload.grid).
  grid_goal: []
};

export const CHECK_KINDS = Object.keys(CHECK_FIELDS) as CheckKind[];

const RUN_KINDS: readonly CheckKind[] = [
  'number_close',
  'numbers_equal',
  'matches_reference',
  'last_line_equals',
  'stdout_contains',
  'stdout_equals',
  'shape_equals',
  'shape_props',
  'shape_contains',
  'var_equals',
  'expr',
  'uses',
  'forbids',
  'grid_goal'
];

/** The kinds that mean something for a task type, most useful first. */
export function checkKindsFor(type: TaskType): readonly CheckKind[] {
  if (type === 'quiz') return ['choice_equals'];
  if (type === 'parsons') return ['order_equals'];
  if (type === 'predict') return ['text_equals', 'choice_equals'];
  return RUN_KINDS;
}

/**
 * Why a kind cannot be added here, or null. TASK_SCHEMA.md: stdout_equals is
 * banned on any task with cases, and the rule is enforced in the authoring UI,
 * not by convention.
 */
export function blockedKind(kind: CheckKind, context: { hasCases: boolean }): 'stdoutWithCases' | null {
  return kind === 'stdout_equals' && context.hasCases ? 'stdoutWithCases' : null;
}

/** A valid starting check of each kind — never a half-built object the evaluator would choke on. */
export function defaultCheck(kind: CheckKind): Check {
  switch (kind) {
    case 'choice_equals':
      return { kind, indices: [0] };
    case 'order_equals':
      return { kind, lines: [] };
    case 'text_equals':
    case 'stdout_equals':
    case 'stdout_contains':
    case 'last_line_equals':
      return { kind, value: '' };
    case 'number_close':
      return { kind, value: 0, tol: 0.01, which: 'last' };
    case 'numbers_equal':
      return { kind, values: [], tol: 0 };
    case 'matches_reference':
      return { kind, compare: 'numbers' };
    case 'var_equals':
      return { kind, name: '', value: 0 };
    case 'expr':
      return { kind, python: '' };
    case 'shape_equals':
      // TASK_SCHEMA.md: use translate unless the task text pins the position down.
      return { kind, normalize: ['translate'] };
    case 'shape_contains':
      return { kind, segments: [] };
    case 'shape_props':
      return { kind, closed: true };
    case 'uses':
      return { kind, all: [] };
    case 'forbids':
      return { kind, names: [] };
    case 'grid_goal':
      return { kind };
  }
}

/** Switches kind, keeping the author's message — the one field every kind shares. */
export function changeKind(check: Check, kind: CheckKind): Check {
  const next = defaultCheck(kind);
  return check.message ? { ...next, message: check.message } : next;
}

/** Keys the builder has no field for. Non-empty means: edit this check as raw JSON. */
export function unsupportedKeys(check: Check): string[] {
  const known = new Set(['kind', 'message', ...CHECK_FIELDS[check.kind].map((field) => field.key)]);
  return Object.keys(check).filter((key) => !known.has(key));
}

function formatNumber(value: number): string {
  return String(value);
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const RANGE = /^\s*(-?\d+(?:[.,]\d+)?)\s*(?:[-–—]\s*(-?\d+(?:[.,]\d+)?)\s*)?$/;

/** The text shown in a field for the current value. */
export function fieldText(check: Check, field: FieldSpec): string {
  const value = (check as Record<string, unknown>)[field.key];
  if (value === undefined) return '';
  switch (field.type) {
    case 'number':
    case 'optionalNumber':
      return typeof value === 'number' ? formatNumber(value) : '';
    case 'numberList':
    case 'stringList':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'bool':
      return value === true ? 'true' : 'false';
    case 'triBool':
      return value === true ? 'true' : value === false ? 'false' : '';
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    case 'which':
      return typeof value === 'number' ? formatNumber(value) : String(value);
    case 'range':
      if (typeof value === 'number') return formatNumber(value);
      if (Array.isArray(value) && value.length === 2) {
        return value[0] === value[1] ? formatNumber(value[0]) : `${value[0]}–${value[1]}`;
      }
      return '';
    case 'normalizeSet':
      return Array.isArray(value) ? value.join(',') : '';
    default:
      return String(value);
  }
}

export type ApplyResult = { ok: true; check: Check } | { ok: false };

function withKey(check: Check, key: string, value: unknown): Check {
  const next: Record<string, unknown> = { ...check };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as Check;
}

/**
 * The check with `field` set from `text`, or `{ ok: false }` while the text
 * does not parse yet (a half-typed number) — the builder keeps showing what
 * was typed and simply does not commit it.
 */
export function applyField(check: Check, field: FieldSpec, text: string): ApplyResult {
  const empty = text.trim() === '';
  switch (field.type) {
    case 'text':
    case 'multiline':
    case 'code':
      return { ok: true, check: withKey(check, field.key, text) };
    case 'number': {
      const value = parseNumber(text);
      return value === null ? { ok: false } : { ok: true, check: withKey(check, field.key, value) };
    }
    case 'optionalNumber': {
      if (empty) return { ok: true, check: withKey(check, field.key, undefined) };
      const value = parseNumber(text);
      return value === null ? { ok: false } : { ok: true, check: withKey(check, field.key, value) };
    }
    case 'numberList': {
      if (empty) return { ok: true, check: withKey(check, field.key, field.required ? [] : undefined) };
      const values = text.split(/[,;\s]+/).filter((part) => part.length > 0).map(parseNumber);
      if (values.some((value) => value === null)) return { ok: false };
      return { ok: true, check: withKey(check, field.key, values) };
    }
    case 'stringList': {
      const values = text
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (values.length === 0) return { ok: true, check: withKey(check, field.key, field.required ? [] : undefined) };
      return { ok: true, check: withKey(check, field.key, values) };
    }
    case 'bool':
      return { ok: true, check: withKey(check, field.key, text === 'true' ? true : undefined) };
    case 'triBool':
      return {
        ok: true,
        check: withKey(check, field.key, text === 'true' ? true : text === 'false' ? false : undefined)
      };
    case 'select':
      if (empty) return { ok: true, check: withKey(check, field.key, undefined) };
      return field.options?.includes(text) ? { ok: true, check: withKey(check, field.key, text) } : { ok: false };
    case 'json': {
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        value = text;
      }
      return { ok: true, check: withKey(check, field.key, value) };
    }
    case 'which': {
      if (empty) return { ok: true, check: withKey(check, field.key, undefined) };
      if (text === 'last' || text === 'first') return { ok: true, check: withKey(check, field.key, text) };
      const index = parseNumber(text);
      return index === null || !Number.isInteger(index)
        ? { ok: false }
        : { ok: true, check: withKey(check, field.key, index) };
    }
    case 'range': {
      if (empty) return { ok: true, check: withKey(check, field.key, undefined) };
      const match = RANGE.exec(text);
      if (!match) return { ok: false };
      const low = parseNumber(match[1]) as number;
      const high = match[2] === undefined ? low : (parseNumber(match[2]) as number);
      if (high < low) return { ok: false };
      const value = !field.pairOnly && low === high ? low : [low, high];
      return { ok: true, check: withKey(check, field.key, value) };
    }
    case 'normalizeSet': {
      const values = text
        .split(',')
        .map((part) => part.trim())
        .filter((part): part is ShapeNormalization => part === 'translate' || part === 'rotate' || part === 'scale');
      return { ok: true, check: withKey(check, field.key, values.length > 0 ? values : undefined) };
    }
  }
}

/** Message is optional: an empty one is dropped so the calm generic line takes over. */
export function applyMessage(check: Check, text: string): Check {
  return withKey(check, 'message', text.trim() === '' ? undefined : text);
}

/** The builder's round trip with the forms, which keep checks as JSON text. */
export function checksToJson(checks: readonly Check[]): string {
  return JSON.stringify(checks, null, 2);
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** One input line per text line; a trailing empty line (the author's last Enter) is not an extra input. */
export function stdinFromText(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** A case's optional fields are dropped when empty, so the JSON stays what a teacher would write by hand. */
export function normalizeCase(runCase: RunCase): RunCase {
  const next: RunCase = { stdin: runCase.stdin };
  if (runCase.label && runCase.label.trim() !== '') next.label = runCase.label;
  if (runCase.hidden) next.hidden = true;
  if (runCase.checks && runCase.checks.length > 0) next.checks = runCase.checks;
  return next;
}
