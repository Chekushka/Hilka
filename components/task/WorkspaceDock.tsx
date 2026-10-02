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
 */
import type { ReactNode } from 'react';
import { EngineLoading } from './EngineLoading';
import { NextTaskButton, type NextTaskAction } from './NextTaskButton';
import { t } from '@/lib/i18n';
import type { EngineState } from '@/lib/task/use-task-runner';

export function WorkspaceDock({
  actions,
  next,
  children
}: {
  actions: ReactNode;
  /** Set once a Check passed: the way on, last and largest on the bar. */
  next?: NextTaskAction;
  children: ReactNode;
}) {
  // Below lg the section dissolves (display: contents) so its bar becomes a
  // child of the work column and can stick to the bottom of the screen: on a
  // phone, Run and Check stay under the thumb while the student scrolls
  // through the code, instead of waiting below the whole editor.
  return (
    <section
      aria-labelledby="workspace-dock-title"
      className="max-lg:contents lg:flex lg:max-h-[52%] lg:flex-none lg:flex-col lg:border-t lg:border-line lg:bg-surface"
    >
      <div className="sticky bottom-0 z-10 flex flex-none flex-wrap items-center gap-3 border-y border-line bg-surface px-5 py-2.5 lg:static lg:border-t-0">
        {/* On a phone the bar must fit Run, Check and the way on in one row, so after a pass
            the label and the status give way — the success panel says it already. */}
        <h2 id="workspace-dock-title" className={`text-sm font-semibold text-ink ${next ? 'max-sm:sr-only' : ''}`}>
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
      <div className="flex min-h-[7rem] flex-1 flex-col gap-3 overflow-y-auto bg-code-bg px-5 py-4">{children}</div>
    </section>
  );
}

/** Shown in the dock before anything has happened, so it is never a blank panel. */
export function DockIdle({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
    />
  );
}

const secondary =
  'rounded-lg border border-line bg-shell px-4 py-2.5 text-sm font-medium text-ink hover:border-accent disabled:opacity-50 disabled:hover:border-line';
const primary =
  'inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-surface disabled:opacity-50';
/** The way on after a pass: the primary look, a step larger, and the success moment's one opening movement. */
const nextClass =
  'success-open inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-6 py-2.5 text-base font-semibold text-surface';

/**
 * Run and Check for the task types that execute Python. Run is the primary
 * button, as in the mockups — it is the one a student presses again and
 * again; Check is always beside it. Four states: idle, running, disabled,
 * and the engine still loading (disabled, with the loading mark in the dock).
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
  /** After a pass the way on is the primary button, so Run steps back. */
  passed?: boolean;
  onRun: () => void;
  onCheck: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onCheck} disabled={disabled} className={secondary}>
        {busy ? t('workspace.checking') : t('workspace.check')}
      </button>
      <button type="button" onClick={onRun} disabled={disabled} className={passed ? `${secondary} inline-flex items-center gap-2` : primary}>
        {busy && <Spinner />}
        {busy ? t('workspace.running') : t('workspace.run')}
      </button>
    </div>
  );
}

/** Check alone, for the task types where nothing runs (quiz, predict, parsons). */
export function CheckAction({
  disabled,
  passed = false,
  onCheck
}: {
  disabled: boolean;
  /** After a pass the way on is the primary button, so Check steps back. */
  passed?: boolean;
  onCheck: () => void;
}) {
  return (
    <button type="button" onClick={onCheck} disabled={disabled} className={passed ? secondary : primary}>
      {t('workspace.check')}
    </button>
  );
}

/** The dock's content before the first run: the engine's wait, or where output will appear. */
export function RunDockIdle({ engine }: { engine: EngineState }) {
  return engine === 'loading' ? <EngineLoading /> : <DockIdle>{t('workspace.outputEmpty')}</DockIdle>;
}
