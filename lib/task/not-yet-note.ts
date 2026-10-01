import type { Check } from '@/lib/checker';

/**
 * Which «Ще не те» note fits the failed checks — where the student should look
 * before trying again. The note used to say "look at the drawing" on every
 * task, which sends a student with a console program looking for a picture
 * that is not there. The first failure decides: it is the one listed first.
 */
export type NotYetNote = 'drawing' | 'grid' | 'output' | 'plain';

export function notYetNote(failed: readonly Check[]): NotYetNote {
  const first = failed[0];
  if (!first) return 'plain';
  switch (first.kind) {
    case 'shape_equals':
    case 'shape_contains':
    case 'shape_props':
      return 'drawing';
    case 'grid_goal':
      return 'grid';
    case 'stdout_equals':
    case 'stdout_contains':
    case 'last_line_equals':
    case 'number_close':
    case 'numbers_equal':
      return 'output';
    default:
      return 'plain';
  }
}
