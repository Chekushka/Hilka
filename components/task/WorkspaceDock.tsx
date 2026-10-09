'use client';

/**
 * The result dock under the work area (WorkspaceFrame): the action buttons on
 * its bar, what the program printed and what Check said below. It grows with
 * what it has to say, up to about half the height, and scrolls after that —
 * the editor above never disappears behind a long message.
 *
 * Once a Check passes, the way on appears on the bar too, right where the
 * student just pressed Check. The success moment itself opens at the top of
 * the task panel (SuccessPanel), but that is across the screen from the
 * pointer — and on a phone, away from the thumb — and students in class did
 * not find it there. Run and Check step back to secondary buttons at the same
 * time, so the bar has one obvious thing to press.
 *
 * The Check button is labelled "hand in" (workspace.check): students did not understand
 * what "check" would do. Run and Hand in are the largest, most contrasting
 * controls on the screen (project owner, after classroom use).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { EngineLoading } from './EngineLoading';
import { NextTaskButton, type NextTaskAction } from './NextTaskButton';
import { StepBadge } from './StepBadge';
import { t } from '@/lib/i18n';
import type { EngineState } from '@/lib/task/use-task-runner';

export function WorkspaceDock({
  actions,
  next,
  tall = false,
  scrollKey,
  children
}: {
  actions: ReactNode;
  /** Set once a Check passed: the way on, last and largest on the bar. */
  next?: NextTaskAction;
  /**
   * For the task types that print: from lg the dock keeps a fixed share of the
   * column instead of growing with its content, so the output always has room
   * on screen and never starts as a sliver at the bottom.
   */
  tall?: boolean;
  /** Changes whenever what the dock shows changes (a run's output, a Check's report); unset before the first. */
  scrollKey?: unknown;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Keep the newest output in sight: from lg the dock scrolls on its own, so it
  // follows the end of the output like a console (an input() question is always
  // the last line); on a phone the output sits under the editor, so it is
  // brought into view. Not after a pass — then the success panel takes the view.
  useEffect(() => {
    const box = contentRef.current;
    if (scrollKey === undefined || scrollKey === null || !box || next) return;
    if (window.matchMedia('(min-width: 64rem)').matches) {
      box.scrollTop = box.scrollHeight;
    } else {
      box.scrollIntoView({ block: 'nearest' });
    }
  }, [scrollKey, next]);

  // Below lg the section dissolves (display: contents) so its bar becomes a
  // child of the work column and can stick to the bottom of the screen: on a
  // phone, Run and Check stay under the thumb while the student scrolls
  // through the code, instead of waiting below the whole editor.
  return (
    <section
      aria-labelledby="workspace-dock-title"
      className={`max-lg:contents lg:flex lg:flex-none lg:flex-col lg:border-t-2 lg:border-line lg:bg-surface ${
        tall ? 'lg:h-[44%] lg:min-h-[11rem]' : 'lg:max-h-[52%]'
      }`}
    >
      <div className="sticky bottom-0 z-10 flex flex-none flex-wrap items-center gap-3 border-y border-line bg-surface px-5 py-2.5 lg:static lg:border-t-0">
        {/* On a phone the bar must fit Run, Check and the way on in one row, so after a pass
            the label and the status give way — the success panel says it already. */}
        <h2
          id="workspace-dock-title"
          className={`flex items-center gap-2.5 text-sm font-bold text-ink ${next ? 'max-sm:sr-only' : ''}`}
        >
          <StepBadge n={3} />
          {t('workspace.result')}
        </h2>
        {next && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-growth max-sm:hidden">
            <span aria-hidden="true">✓</span>
            {t('result.passed')}
          </span>
        )}
        <span className="flex-1" />
        {actions}
        {next && (
          <NextTaskButton action={next} className={nextClass}>
            {next.shortLabel ?? next.label}
            <span aria-hidden="true">→</span>
          </NextTaskButton>
        )}
      </div>
      <div
        ref={contentRef}
        className="flex min-h-[7rem] flex-1 flex-col gap-3 overflow-y-auto bg-code-bg px-5 py-4 max-lg:scroll-mb-24"
      >
        {children}
      </div>
    </section>
  );
}

/** Shown in the dock before anything has happened, so it is never a blank panel. */
export function DockIdle({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

const secondary =
  'inline-flex items-center gap-2 rounded-xl border border-line bg-shell px-4 py-2.5 text-sm font-medium text-ink hover:border-accent disabled:opacity-50 disabled:hover:border-line';
/**
 * The two actions a student presses again and again, large and solid so they
 * read from the back row: Run in the accent, Hand in in growth —
 * different colours, and a different icon each, so they are never confused.
 */
const big = 'inline-flex min-h-12 items-center gap-2.5 rounded-xl px-6 py-3 text-base font-bold disabled:opacity-60';
const runClass = `${big} bg-accent text-surface hover:brightness-110`;
const submitClass = `${big} bg-growth text-on-bright hover:brightness-105`;
/** The way on after a pass: the primary look, a step larger, and the success moment's one opening movement. */
const nextClass = `success-open ${big} bg-accent text-surface`;

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 flex-none">
      <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
    </svg>
  );
}

function SubmitIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 flex-none">
      <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 flex-none rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
    />
  );
}

/**
 * Run and Hand in for the task types that execute Python. Run comes first —
 * it is the one pressed again and again — and Hand in beside it. Four states:
 * idle, running, disabled, and the engine still loading (disabled, with the
 * loading mark in the dock).
 */
export function RunCheckActions({
  busy,
  disabled,
  passed = false,
  onRun,
  onCheck
}: {
  busy: boolean;
  disabled: boolean;
  /** After a pass the way on is the primary button, so both step back. */
  passed?: boolean;
  onRun: () => void;
  onCheck: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={onRun} disabled={disabled} className={passed ? secondary : runClass}>
        {busy ? <Spinner /> : <PlayIcon />}
        {busy ? t('workspace.running') : t('workspace.run')}
      </button>
      <button type="button" onClick={onCheck} disabled={disabled} className={passed ? secondary : submitClass}>
        <SubmitIcon />
        {busy ? t('workspace.checking') : t('workspace.check')}
      </button>
    </div>
  );
}

/** Hand in alone, for the task types where nothing runs (quiz, predict, parsons). */
export function CheckAction({
  disabled,
  passed = false,
  onCheck
}: {
  disabled: boolean;
  /** After a pass the way on is the primary button, so Hand in steps back. */
  passed?: boolean;
  onCheck: () => void;
}) {
  return (
    <button type="button" onClick={onCheck} disabled={disabled} className={passed ? secondary : submitClass}>
      <SubmitIcon />
      {t('workspace.check')}
    </button>
  );
}

/** The dock's content before the first run: the engine's wait, or where output will appear. */
export function RunDockIdle({ engine }: { engine: EngineState }) {
  return engine === 'loading' ? <EngineLoading /> : <DockIdle>{t('workspace.outputEmpty')}</DockIdle>;
}
