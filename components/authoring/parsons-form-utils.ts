/**
 * A parsons task's lines, as a teacher can type them: one program line per
 * row, prefixed with its indent level and a colon — `1:turtle.forward(100)`
 * — the same "plain text field, not a per-kind visual builder" idea
 * task-form-utils.ts already uses for hints and grade tags.
 */
import type { ParsonsLine } from '@/lib/task/types';

export function parseParsonsLines(text: string): ParsonsLine[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/^(\d+):(.*)$/);
      if (!match) {
        return { text: line, indent: 0 };
      }
      return { text: match[2], indent: Number(match[1]) };
    });
}

export function formatParsonsLines(lines: ParsonsLine[]): string {
  return lines.map((line) => `${line.indent}:${line.text}`).join('\n');
}
