/**
 * A lesson's theory shown to the whole class on a projector or an interactive
 * whiteboard (docs/TASKS.md, "Theory on the projector"). The same cards as
 * the student's deck (lib/lessons/theory.ts), but the teacher leads: nothing
 * waits for an answer, every card can be jumped to, and a «Як думаєш?» card
 * takes one press of "forward" to open its answer — the class votes first,
 * then sees what the program prints — and another to move on. Nothing is
 * recorded.
 *
 * Pure: what a key does and where "forward" leads.
 */

export type PresentAction = 'forward' | 'back' | 'first' | 'last' | 'fullscreen' | 'bigger' | 'smaller';

/**
 * What a key does. Presentation remotes send PageDown/PageUp (some send the
 * arrows); `F` is matched by its physical key, so it works on the Ukrainian
 * layout too, where the same key types «а».
 */
export function presentKeyAction(key: string, code: string): PresentAction | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      return 'forward';
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return 'back';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case '+':
    case '=':
      return 'bigger';
    case '-':
      return 'smaller';
  }
  return code === 'KeyF' ? 'fullscreen' : null;
}

export type ForwardStep = { kind: 'reveal' } | { kind: 'move'; to: number } | { kind: 'stay' };

/** "Forward" on card `current` of `last + 1`: open the card's unanswered guesses first, then go on. */
export function forwardStep(current: number, last: number, hasHiddenAnswer: boolean): ForwardStep {
  if (hasHiddenAnswer) return { kind: 'reveal' };
  return current < last ? { kind: 'move', to: current + 1 } : { kind: 'stay' };
}

/**
 * Text size: the whole page is in rem, so the root font size scales every
 * card at once. It follows the smaller of the window's width and height — a
 * 4:3 projector and a 16:9 board both fit a card — times the teacher's own
 * factor for their room, which this browser remembers.
 */
export const SCALE_MIN = 0.7;
export const SCALE_MAX = 1.6;
const SCALE_STEP = 0.1;

export function stepScale(scale: number, direction: 1 | -1): number {
  return clampScale(Math.round((scale + direction * SCALE_STEP) * 10) / 10);
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

/** About 21px at 1366×768 and 29px at 1920×1080 at the factor 1: a guess card and its answer fit one screen. */
export function rootFontSize(scale: number): string {
  const factor = clampScale(scale);
  return `clamp(${Math.round(14 * factor)}px, calc(min(1.7vw, 2.7vh) * ${factor}), ${Math.round(48 * factor)}px)`;
}
