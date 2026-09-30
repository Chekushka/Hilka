/**
 * An attempt's `submitted_answer`, turned back into something a teacher can
 * read on the student card: the code a student checked, the options they
 * ticked, the lines they put in order. Pure; the card renders the result.
 *
 * The answer is stored as the task-type view reported it
 * (`AttemptOutcome.submittedAnswer`, lib/task/types.ts) — indices, not text,
 * for quiz, choice-mode predict and parsons — so reading it needs the task's
 * payload. Published content is not edited in place (a new version is a new
 * publish), but an import can overwrite a task by slug; an index that no
 * longer names anything is shown as missing rather than guessed at.
 */
import type { TaskPayload } from '@/lib/task/types';

export type AnswerView =
  | { kind: 'code'; code: string }
  | { kind: 'text'; text: string }
  | { kind: 'choices'; options: { text: string; chosen: boolean }[]; missing: number }
  | { kind: 'lines'; lines: { text: string; indent: number; distractor: boolean }[]; missing: number }
  | { kind: 'unreadable' };

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

function choices(options: string[], picked: number[]): AnswerView {
  const chosen = new Set(picked);
  return {
    kind: 'choices',
    options: options.map((text, index) => ({ text, chosen: chosen.has(index) })),
    missing: picked.filter((index) => index < 0 || index >= options.length).length
  };
}

export function describeSubmittedAnswer(
  payload: TaskPayload,
  answer: Record<string, unknown> | null
): AnswerView {
  if (!answer) return { kind: 'unreadable' };

  switch (payload.type) {
    case 'code':
    case 'fix':
    case 'fill':
      return typeof answer.code === 'string' ? { kind: 'code', code: answer.code } : { kind: 'unreadable' };

    case 'quiz':
      return isIntegerArray(answer.choiceIndices) ? choices(payload.options, answer.choiceIndices) : { kind: 'unreadable' };

    case 'predict':
      if (typeof answer.text === 'string') return { kind: 'text', text: answer.text };
      if (isIntegerArray(answer.choiceIndices)) return choices(payload.options ?? [], answer.choiceIndices);
      return { kind: 'unreadable' };

    case 'parsons': {
      const ordered = answer.orderedLines;
      if (!Array.isArray(ordered)) return { kind: 'unreadable' };
      // Same index space as lib/task/parsons.ts's parsonsPool: real lines first, then distractors.
      const pool = [
        ...payload.lines.map((line) => ({ text: line.text, distractor: false })),
        ...(payload.distractors ?? []).map((text) => ({ text, distractor: true }))
      ];
      const lines: { text: string; indent: number; distractor: boolean }[] = [];
      let missing = 0;
      for (const item of ordered) {
        const index = (item as { index?: unknown })?.index;
        const indent = (item as { indent?: unknown })?.indent;
        const entry = Number.isInteger(index) ? pool[index as number] : undefined;
        if (!entry) {
          missing += 1;
          continue;
        }
        lines.push({ ...entry, indent: Number.isInteger(indent) ? Math.max(0, indent as number) : 0 });
      }
      return { kind: 'lines', lines, missing };
    }
  }
}
