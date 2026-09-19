/**
 * `fill` payload → the parsed template and the substitution that turns a
 * student's gap answers into runnable code. Pure — no DOM, no runner — so
 * both the authoring validation and `FillTaskView` share the same parse.
 */
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
