/**
 * All user-facing text is Ukrainian and lives in messages/uk.json — never as a
 * string literal in a component. One language for now; this is the seam where a
 * second would go, not a reason to add a library.
 */
import uk from '@/messages/uk.json';

type Messages = typeof uk;

/** Dot path into the message tree, e.g. t('workspace.run'). */
export function t(path: string, values?: Record<string, string | number>): string {
  const parts = path.split('.');
  let current: unknown = uk as Messages;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return path; // visible in the UI, which is how a missing key gets noticed
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== 'string') {
    return path;
  }
  if (!values) {
    return current;
  }
  return current.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}
