'use client';

/**
 * The screen that occupies thirty minutes of a lesson (docs/mockups, the
 * workspace screen). Every task type renders inside this one frame, so the
 * student learns the layout once:
 *
 *   ┌ task panel ──────┬ work area (editor, options, lines…) ─┐
 *   │ where you are    │                                      │
 *   │ type · title     │                                      │
 *   │ statement        ├ result dock ─────────── actions ─────┤
 *   │ how it works     │ output, then the result              │
 *   │ hint (pinned)    │                                      │
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
 * Layout only: each task-type view still owns its state and its Check
 * (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import { useState, type ReactNode } from 'react';
import { Hints } from './Hints';
import { t } from '@/lib/i18n';
import type { Task } from '@/lib/task/types';
import { PromptText } from './PromptText';

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
    <div className="border-t border-line px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 text-left text-sm font-semibold text-ink"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-none items-center justify-center rounded bg-accent-soft text-xs font-bold text-accent"
        >
          {open ? '−' : '+'}
        </span>
        {t('workspace.theory')}
        <span className="flex-1" />
        <span className="text-xs font-normal text-ink-muted">
          {open ? t('workspace.theoryHide') : t('workspace.theoryShow')}
        </span>
      </button>
      {open && <div className="mt-3 text-sm">{children}</div>}
    </div>
  );
}

export function WorkspaceFrame({ task, chrome, hints, onRevealHint, success, dock, children }: WorkspaceFrameProps) {
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:min-h-[36rem] lg:flex-row">
      <aside className="flex flex-col border-b border-line bg-surface lg:w-[23rem] lg:flex-none lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-[24.5rem]">
        {chrome?.context && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3 text-sm">
            {chrome.context}
          </div>
        )}
        {success}
        {chrome?.notice}
        <section className="px-5 pb-5 pt-5">
          <p className="text-sm font-semibold text-accent">{t(`task.types.${task.type}`)}</p>
          <h1 className="mt-1.5 text-2xl font-semibold leading-tight text-ink">{task.title}</h1>
          <PromptText
            prompt={task.payload.prompt}
            className="mt-3 text-base leading-relaxed text-ink"
            noCopy={task.tags?.includes('retype')}
          />
          {task.tags?.includes('retype') && (
            <p className="mt-3 text-sm text-ink-muted" data-testid="retype-note">
              {t('workspace.retypeNote')}
            </p>
          )}
        </section>
        {chrome?.theory && <Theory>{chrome.theory}</Theory>}
        <span className="flex-1" />
        {hints.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <Hints hints={hints} onReveal={onRevealHint} />
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col lg:overflow-y-auto">{children}</div>
        {dock}
      </div>
    </div>
  );
}
