'use client';

/**
 * The screen that occupies thirty minutes of a lesson (docs/mockups, the
 * workspace screen). Every task type renders inside this one frame, so the
 * student learns the layout once:
 *
 *   ┌ task panel ──────┬ work area (editor, options, lines…) ─┐
 *   │ where you are    │                                      │
 *   │ ┏ what to do ━━┓ │                                      │
 *   │ ┃ title, text  ┃ ├ result dock ─────────── actions ─────┤
 *   │ ┗━━━━━━━━━━━━━━┛ │ output, then the result              │
 *   │ hint (honey)     │                                      │
 *   │ how it works     │                                      │
 *   └──────────────────┴──────────────────────────────────────┘
 *
 * From `lg` up it fills the viewport under the app bar and each zone scrolls
 * on its own, so the statement never scrolls away from the editor. Below
 * that it stacks into one ordinary scrolling column.
 *
 * What the brief asks this frame to decide: a long statement scrolls inside
 * the task panel, never pushing the editor down; the theory stays collapsed
 * under "how it works" unless asked for; a visual (the turtle canvas) sits
 * beside the editor, not under it. Calm, adult and quiet — the reward layer
 * lives between tasks, and none of it is allowed in here.
 *
 * Quiet is not flat, though (decided with the project owner after classroom
 * use): students did not see what was asked of them and read the theory
 * instead, and missed the hint at the bottom of the panel. So the statement
 * is a bordered card in the accent colour on a darker panel, the hint sits
 * right under it in honey, and the theory is the quietest thing here.
 *
 * Layout only: each task-type view still owns its state and its Check
 * (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import { useState, type ReactNode } from 'react';
import { Hints } from './Hints';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';
import { PromptText } from './PromptText';
import { StepBadge } from './StepBadge';

/** The task types whose answer is a program the engine runs. */
const RUNNABLE: ReadonlySet<Task['type']> = new Set(['code', 'fix', 'fill']);

/** What the page around a task adds to the task panel. The task-type views pass it through untouched. */
export interface WorkspaceChrome {
  /** Top of the task panel: the way back, the task's position, the way on. */
  context?: ReactNode;
  /** Above the statement: advice such as a file task's prerequisite. */
  notice?: ReactNode;
  /** The lesson's explanation, kept collapsed under "how it works". */
  theory?: ReactNode;
}

interface WorkspaceFrameProps {
  task: Task;
  chrome?: WorkspaceChrome;
  /** Already empty when a graded session turns hints off. */
  hints: string[];
  onRevealHint: () => void;
  /** SuccessPanel once a Check passed: opens at the top of the task panel, above the statement. */
  success?: ReactNode;
  /** The result dock (WorkspaceDock). */
  dock: ReactNode;
  /** The work area. */
  children: ReactNode;
}

function Theory({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-4 rounded-lg border border-line bg-surface/60 px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 text-left text-sm font-medium text-ink-muted hover:text-ink"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-none items-center justify-center rounded border border-line text-xs font-bold"
        >
          {open ? '−' : '+'}
        </span>
        {t('workspace.theory')}
        <span className="flex-1" />
        <span className="text-xs font-normal">{open ? t('workspace.theoryHide') : t('workspace.theoryShow')}</span>
      </button>
      {!open && <p className="mt-1 pl-7.5 text-xs text-ink-muted">{t('workspace.theoryNote')}</p>}
      {open && <div className="mt-3 text-sm text-ink">{children}</div>}
    </div>
  );
}

export function WorkspaceFrame({ task, chrome, hints, onRevealHint, success, dock, children }: WorkspaceFrameProps) {
  const retype = task.tags?.includes('retype');
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:min-h-[36rem] lg:flex-row">
      <aside className="flex flex-col gap-3 border-b border-line bg-shell pb-4 lg:w-[23rem] lg:flex-none lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-[25rem]">
        {chrome?.context && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-2.5 text-sm">
            {chrome.context}
          </div>
        )}
        {success}
        {chrome?.notice}
        {/* What to do comes first and loudest: students read whatever stands out, and
            when the statement was plain text among plain text they read the theory instead. */}
        <section
          aria-labelledby="task-card-title"
          data-testid="task-card"
          className="mx-4 overflow-hidden rounded-xl border-2 border-accent bg-surface shadow-[var(--shadow-raised)]"
        >
          <div className="flex items-center gap-2 bg-accent px-4 py-2 text-surface">
            <StepBadge n={1} inverted />
            <span className="text-sm font-bold">{t('workspace.taskLabel')}</span>
          </div>
          <div className="px-4 pb-5 pt-3.5">
            <h1 id="task-card-title" className="text-2xl font-bold leading-tight text-ink">
              {task.title}
            </h1>
            <PromptText prompt={task.payload.prompt} className="mt-3 text-lg leading-relaxed text-ink" noCopy={retype} />
            {retype && (
              <p className="mt-3 text-sm text-ink-muted" data-testid="retype-note">
                {t('workspace.retypeNote')}
              </p>
            )}
          </div>
        </section>
        {/* Right under the statement, where a stuck student's eyes already are — not pinned
            to the bottom of the panel, where nobody found it. */}
        {/* Once the task is solved, a phone drops the hint and the theory: the panel must stay
            short enough that the work column — and the way on stuck to its bottom — is on screen. */}
        <div className={`flex flex-col gap-3 ${success ? 'max-lg:hidden' : ''}`}>
          {hints.length > 0 && (
            <div className="mx-4">
              <Hints hints={hints} onReveal={onRevealHint} />
            </div>
          )}
          {chrome?.theory && <Theory>{chrome.theory}</Theory>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 flex-none items-center gap-2.5 border-b border-line bg-surface px-5">
          <StepBadge n={2} />
          <h2 className="text-sm font-bold text-ink">{t(`workspace.work.${task.type}`)}</h2>
          <span className="flex-1" />
          {RUNNABLE.has(task.type) && <span className="text-xs text-ink-muted">{t('workspace.editorEngine')}</span>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:overflow-y-auto">{children}</div>
        {dock}
      </div>
    </div>
  );
}
