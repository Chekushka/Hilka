import type { CellStatus } from '@/lib/dashboard/rollup';
import type { StudentState } from '@/lib/dashboard/class-status';
import type { Ago } from '@/lib/dashboard/time';
import { t } from '@/lib/i18n';

/**
 * Shape carries the state, colour only reinforces it
 * (docs/design-brief-python-platform.md, "Never encode state in color
 * alone"): a dot for working, a diamond for needing help, a ticked square
 * for finished, an empty ring for not started — the mockups' class screen.
 * Sized for the back row when the teacher puts the class on the projector.
 */

const STATE_LABEL: Record<StudentState, string> = {
  not_started: 'dashboard.stateNotStarted',
  working: 'dashboard.stateWorking',
  stuck: 'dashboard.stateStuck',
  finished: 'dashboard.stateFinished'
};

export function stateLabel(state: StudentState): string {
  return t(STATE_LABEL[state]);
}

export const STATE_TEXT_CLASS: Record<StudentState, string> = {
  not_started: 'text-ink-muted',
  working: 'text-accent',
  stuck: 'text-attention',
  finished: 'text-growth'
};

export function agoText(ago: Ago): string {
  if (ago.unit === 'now') return t('dashboard.agoNow');
  return t(ago.unit === 'minutes' ? 'dashboard.agoMinutes' : 'dashboard.agoHours', { n: ago.n });
}

function Shape({
  kind,
  size
}: {
  kind: 'dot' | 'diamond' | 'tick' | 'ring' | 'hollow-diamond' | 'dash';
  size: number;
}) {
  const box = { width: size, height: size };
  switch (kind) {
    case 'dash':
      return (
        <span className="inline-flex shrink-0 items-center justify-center" style={box}>
          <span className="block h-0.5 w-2/3 rounded bg-line" />
        </span>
      );
    case 'dot':
      return <span className="inline-block shrink-0 rounded-full bg-accent" style={box} />;
    case 'ring':
      return <span className="inline-block shrink-0 rounded-full border-2 border-ink-muted" style={box} />;
    case 'diamond':
      return <span className="inline-block shrink-0 rotate-45 rounded-[2px] bg-attention" style={{ width: size * 0.8, height: size * 0.8, margin: size * 0.1 }} />;
    case 'hollow-diamond':
      return (
        <span
          className="inline-block shrink-0 rotate-45 rounded-[2px] border-2 border-attention"
          style={{ width: size * 0.8, height: size * 0.8, margin: size * 0.1 }}
        />
      );
    case 'tick':
      return (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-growth text-surface"
          style={box}
        >
          <svg viewBox="0 0 12 12" width={size * 0.75} height={size * 0.75} aria-hidden="true">
            <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
  }
}

const STATE_SHAPE: Record<StudentState, 'dot' | 'diamond' | 'tick' | 'ring'> = {
  not_started: 'ring',
  working: 'dot',
  stuck: 'diamond',
  finished: 'tick'
};

/** A student's state as a shape. Decorative: the word always sits next to it. */
export function StateMark({ state, size = 14 }: { state: StudentState; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex">
      <Shape kind={STATE_SHAPE[state]} size={size} />
    </span>
  );
}

/**
 * One task of one student: ticked when passed, an outlined diamond when tried
 * and not passed yet, an empty ring when not reached. Labelled, since in the
 * class table's task strip there is no word beside it.
 */
export function CellMark({
  status,
  attempts,
  size = 14,
  label: ownLabel,
  decorative = false
}: {
  status: CellStatus;
  attempts: number;
  size?: number;
  /** Replaces the default wording, e.g. to name the task too. */
  label?: string;
  /** When a word beside it already says the same. */
  decorative?: boolean;
}) {
  const label =
    ownLabel ??
    (status === 'passed'
      ? t('dashboard.resultPassed')
      : status === 'stuck'
        ? t('dashboard.rollupStuck', { n: attempts })
        : status === 'not_assigned'
          ? t('dashboard.rollupNotAssigned')
          : t('dashboard.rollupNotStarted'));
  const kind =
    status === 'passed' ? 'tick' : status === 'stuck' ? 'hollow-diamond' : status === 'not_assigned' ? 'dash' : 'ring';
  if (decorative) {
    return (
      <span aria-hidden="true" className="inline-flex">
        <Shape kind={kind} size={size} />
      </span>
    );
  }
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      <Shape kind={kind} size={size} />
    </span>
  );
}
