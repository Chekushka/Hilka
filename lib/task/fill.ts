/**
 * `fill` payload → the parsed template and the substitution that turns a
 * student's gap answers into runnable code. Pure — no DOM, no runner — so
 * both the authoring validation and `FillTaskView` share the same parse.
 */
import { createRng, deriveSeed } from '@/lib/seed/prng';
import type { FillPayload } from './types';

export type FillPart = { kind: 'text'; value: string } | { kind: 'gap'; index: number };

const GAP_PATTERN = /\{\{(\d+)\}\}/g;

/** Splits a template into literal text and numbered gaps, in source order. */
export function parseFillTemplate(template: string): FillPart[] {
  const parts: FillPart[] = [];
  let lastIndex = 0;
  for (const match of template.matchAll(GAP_PATTERN)) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ kind: 'text', value: template.slice(lastIndex, start) });
    }
    parts.push({ kind: 'gap', index: Number(match[1]) });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < template.length) {
    parts.push({ kind: 'text', value: template.slice(lastIndex) });
  }
  return parts;
}

/** Every distinct gap index a template declares, in first-appearance order. */
export function fillTemplateGaps(template: string): number[] {
  const seen = new Set<number>();
  for (const part of parseFillTemplate(template)) {
    if (part.kind === 'gap') seen.add(part.index);
  }
  return [...seen];
}

/** Assembles runnable code from a template and the student's answer per gap index. An unanswered gap substitutes the empty string, same as a blank the student hasn't filled yet. */
export function substituteFillTemplate(template: string, values: Record<number, string>): string {
  return parseFillTemplate(template)
    .map((part) => (part.kind === 'text' ? part.value : (values[part.index] ?? '')))
    .join('');
}

export function isFillTemplateValid(template: FillPayload['template']): boolean {
  return fillTemplateGaps(template).length > 0;
}

/** At most this many cards: past it the bank stops being a choice and becomes a search. */
export const MAX_BANK_CARDS = 12;

/** A word bank's shape: non-empty cards, at least one per gap, not too many (docs/TASK_SCHEMA.md, `fill`). */
export function isFillBankValid(template: string, bank: unknown): bank is string[] {
  return (
    Array.isArray(bank) &&
    bank.every((card) => typeof card === 'string' && card.trim() !== '' && card === card.trim() && !card.includes('\n')) &&
    bank.length >= fillTemplateGaps(template).length &&
    bank.length <= MAX_BANK_CARDS
  );
}

/**
 * With a word bank, the reference must be the template filled from the bank:
 * that is what makes a drag task solvable at all (rule 5 — the answer is a run
 * of the author's reference, so the cards have to be able to build it). Finds
 * which card goes into which gap, each card used once, or null when no choice
 * of cards turns the template into exactly `referenceCode`. Trailing spaces and
 * line endings are ignored, as the editor ignores them.
 *
 * A gap that appears twice in the template takes the same card both times.
 */
export function fillFromBank(template: string, bank: readonly string[], referenceCode: string): Record<number, string> | null {
  const norm = (text: string) => text.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
  const target = norm(referenceCode);
  const parts = parseFillTemplate(norm(template));
  const used = new Array<boolean>(bank.length).fill(false);
  const chosen: Record<number, string> = {};

  const walk = (part: number, at: number): boolean => {
    if (part === parts.length) return at === target.length;
    const current = parts[part];
    if (current.kind === 'text') {
      return target.startsWith(current.value, at) && walk(part + 1, at + current.value.length);
    }
    const already = chosen[current.index];
    if (already !== undefined) {
      return target.startsWith(already, at) && walk(part + 1, at + already.length);
    }
    for (let card = 0; card < bank.length; card++) {
      if (used[card] || !target.startsWith(bank[card], at)) continue;
      used[card] = true;
      chosen[current.index] = bank[card];
      if (walk(part + 1, at + bank[card].length)) return true;
      used[card] = false;
      delete chosen[current.index];
    }
    return false;
  };

  return walk(0, 0) ? { ...chosen } : null;
}

/**
 * The order a bank's cards are shown in: shuffled, so the right ones are not
 * simply the first ones the author wrote, but by the task's own id — the same
 * on the server and in the browser, on every visit, for every student.
 */
export function bankDisplayOrder(bank: readonly string[], taskId: string): string[] {
  const rng = createRng(deriveSeed('bank', taskId, bank.join('\u0001')));
  const out = [...bank];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
