/**
 * What the editor saw while a task was open (docs/HOMEWORK.md, section 5,
 * "Behavioural facts"): how many edits, and the largest single paste. Counts
 * only — never the text typed or pasted, never keystrokes or timing. Like
 * hints, the counts run from the moment the task screen opened, so each
 * attempt carries the totals so far. Recorded for homework only; the server
 * decides that, not the room.
 */

export interface EditorActivity {
  /** Changes to the code other than pastes: typing, deleting, the key bar, undo. */
  edits: number;
  /** The largest single paste (or drop), in characters and in lines. */
  largestPasteChars: number;
  largestPasteLines: number;
}

export const NO_ACTIVITY: EditorActivity = { edits: 0, largestPasteChars: 0, largestPasteLines: 0 };

/** One change to the document: `pasted` is the inserted text when it was a paste or a drop, else null. */
export function recordChange(activity: EditorActivity, change: { pasted: string | null }): EditorActivity {
  if (change.pasted === null) return { ...activity, edits: activity.edits + 1 };
  const chars = change.pasted.length;
  const lines = chars === 0 ? 0 : change.pasted.replace(/\n+$/, '').split('\n').length;
  return {
    ...activity,
    largestPasteChars: Math.max(activity.largestPasteChars, chars),
    largestPasteLines: Math.max(activity.largestPasteLines, lines)
  };
}

const LIMIT = 1_000_000;

/** An untrusted request body's activity, or null when it is not one. Never trusted beyond being three sane counts. */
export function parseActivity(value: unknown): EditorActivity | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const count = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= LIMIT ? n : null);
  const edits = count(v.edits);
  const largestPasteChars = count(v.largestPasteChars);
  const largestPasteLines = count(v.largestPasteLines);
  if (edits === null || largestPasteChars === null || largestPasteLines === null) return null;
  return { edits, largestPasteChars, largestPasteLines };
}
