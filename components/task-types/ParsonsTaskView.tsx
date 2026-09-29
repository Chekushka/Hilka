'use client';

/**
 * A Parsons puzzle: assemble a program from lines given out of order,
 * distractors mixed in. Nothing executes and nothing can raise a syntax
 * error, so feedback is instant (docs/TASK_SCHEMA.md) — Check runs the
 * declarative evaluator directly against the assembled order, no runner
 * involved.
 *
 * `indentMode: 'given'` shows each line's indent for context, fixed, not
 * graded. `'chosen'` (lib/task/types.ts) hides it — every line starts flat
 * and the student sets its indent with the Indent/Outdent buttons on each
 * answer row, graded by `order_equals`'s `checkIndent`/`indents`.
 *
 * Reordering works by drag (@dnd-kit, pointer + keyboard sensors) and by the
 * add/remove buttons alone, so a student who cannot or does not want to drag
 * still has a complete keyboard path: remove and re-add in the right order.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { evaluateChecks, type CheckReport } from '@/lib/checker';
import { CheckReportPanel } from '@/components/task/CheckReportPanel';
import type { NextTaskAction } from '@/components/task/NextTaskButton';
import { CheckAction, DockIdle, WorkspaceDock } from '@/components/task/WorkspaceDock';
import { WorkspaceFrame, type WorkspaceChrome } from '@/components/task/WorkspaceFrame';
import { t } from '@/lib/i18n';
import { parsonsPool, type ParsonsPoolItem } from '@/lib/task/parsons';
import type { AttemptOutcome, ParsonsTask } from '@/lib/task/types';

interface ParsonsTaskViewProps {
  task: ParsonsTask;
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
  next?: NextTaskAction;
  chrome?: WorkspaceChrome;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** One step of indentation, drawn as a guide line — the shape of the block, not a count of spaces. */
function IndentGuides({ level }: { level: number }) {
  return (
    <>
      {Array.from({ length: level }, (_, i) => (
        <span key={i} aria-hidden="true" className="w-6 flex-none self-stretch border-l-2 border-dashed border-line" />
      ))}
    </>
  );
}

const lineClass = 'whitespace-pre font-mono text-base text-ink';

function BankRow({ item, onAdd }: { item: ParsonsPoolItem; onAdd: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-line bg-surface px-4 py-2.5 hover:border-accent">
      <span className={lineClass}>{item.text}</span>
      <button
        type="button"
        onClick={onAdd}
        className="flex-none rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
      >
        {t('parsons.add')}
      </button>
    </li>
  );
}

function AnswerRow({
  item,
  indent,
  onRemove,
  onIndentChange
}: {
  item: ParsonsPoolItem;
  indent: number;
  onRemove: () => void;
  /** Present only in `indentMode: 'chosen'` — absent means indent is fixed, per `'given'`. */
  onIndentChange?: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.poolIndex
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  // Lifted while dragged: the one raised shadow, so the block feels picked up.
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative flex items-stretch gap-2 rounded-lg border-[1.5px] bg-surface py-2 pl-2 pr-3 ${
        isDragging ? 'z-10 border-accent shadow-[var(--shadow-raised)]' : 'border-line hover:border-accent'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('parsons.dragHandle')}
        className={`flex-none rounded-md px-1.5 text-lg leading-none text-ink-muted hover:bg-accent-soft ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        ⠿
      </button>
      <IndentGuides level={indent} />
      <span className={`flex-1 self-center ${lineClass}`}>{item.text}</span>
      <span className="flex flex-none items-center gap-2">
        {onIndentChange && (
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <button
              type="button"
              onClick={() => onIndentChange(-1)}
              disabled={indent === 0}
              aria-label={t('parsons.indentOut')}
              className="rounded-md border border-line px-2 py-1 text-sm text-ink hover:border-accent disabled:opacity-30"
            >
              ←
            </button>
            <span aria-live="polite" className="min-w-[6.5rem] text-center">
              {t('parsons.indentLabel', { level: indent })}
            </span>
            <button
              type="button"
              onClick={() => onIndentChange(1)}
              aria-label={t('parsons.indentIn')}
              className="rounded-md border border-line px-2 py-1 text-sm text-ink hover:border-accent"
            >
              →
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          {t('parsons.remove')}
        </button>
      </span>
    </li>
  );
}

export function ParsonsTaskView({ task, onSubmitAttempt, hintsEnabled = true, next, chrome }: ParsonsTaskViewProps) {
  const isChosen = task.payload.indentMode === 'chosen';
  const pool = useMemo(() => parsonsPool(task.payload), [task.payload]);
  const byIndex = useMemo(() => new Map(pool.map((item) => [item.poolIndex, item])), [pool]);

  const [bank, setBank] = useState<number[]>(() => shuffled(pool.map((item) => item.poolIndex)));
  const [answer, setAnswer] = useState<number[]>([]);
  // 'chosen' only — every line starts flat; the student sets each one's
  // indent, which is the whole thing being graded. Unset entries read as 0.
  const [chosenIndents, setChosenIndents] = useState<Record<number, number>>({});
  const [report, setReport] = useState<CheckReport | null>(null);

  function indentOf(poolIndex: number): number {
    return isChosen ? (chosenIndents[poolIndex] ?? 0) : (byIndex.get(poolIndex)?.indent ?? 0);
  }

  function changeIndent(poolIndex: number, delta: number) {
    setReport(null);
    setChosenIndents((previous) => ({
      ...previous,
      [poolIndex]: Math.max(0, (previous[poolIndex] ?? 0) + delta)
    }));
  }

  const hintsUsedRef = useRef(0);
  const openedAtRef = useRef(0);
  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function addToAnswer(poolIndex: number) {
    setReport(null);
    setBank((previous) => previous.filter((i) => i !== poolIndex));
    setAnswer((previous) => [...previous, poolIndex]);
  }

  function removeFromAnswer(poolIndex: number) {
    setReport(null);
    setAnswer((previous) => previous.filter((i) => i !== poolIndex));
    setBank((previous) => [...previous, poolIndex].sort((a, b) => a - b));
    // Re-adding starts flat again, same as its first placement.
    setChosenIndents((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([key]) => Number(key) !== poolIndex))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setReport(null);
    setAnswer((previous) => {
      const from = previous.indexOf(Number(active.id));
      const to = previous.indexOf(Number(over.id));
      if (from === -1 || to === -1) return previous;
      return arrayMove(previous, from, to);
    });
  }

  function check() {
    const submission = {
      orderedLines: answer.map((poolIndex) => ({ index: poolIndex, indent: indentOf(poolIndex) }))
    };
    const nextReport = evaluateChecks(task.checks, { submission });
    setReport(nextReport);
    onSubmitAttempt?.({
      passed: nextReport.passed,
      hintsUsed: hintsUsedRef.current,
      durationMs: Date.now() - openedAtRef.current,
      submittedAnswer: submission
    });
  }

  return (
    <WorkspaceFrame
      task={task}
      chrome={chrome}
      hints={hintsEnabled ? task.hints : []}
      onRevealHint={() => (hintsUsedRef.current += 1)}
      dock={
        <WorkspaceDock actions={<CheckAction disabled={answer.length === 0} onCheck={check} />}>
          {report ? <CheckReportPanel report={report} next={next} /> : <DockIdle>{t('workspace.checkIdle')}</DockIdle>}
        </WorkspaceDock>
      }
    >
      <div className="flex flex-col gap-6 px-6 py-6 lg:px-8">
        <section aria-labelledby="parsons-bank-title">
          <h2 id="parsons-bank-title" className="text-sm font-semibold text-ink-muted">
            {t('parsons.bankTitle')}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {bank.length === 0 && <li className="text-sm text-ink-muted">{t('parsons.bankEmpty')}</li>}
            {bank.map((poolIndex) => {
              const item = byIndex.get(poolIndex);
              return item ? <BankRow key={poolIndex} item={item} onAdd={() => addToAnswer(poolIndex)} /> : null;
            })}
          </ul>
        </section>

        <section aria-labelledby="parsons-answer-title">
          <h2 id="parsons-answer-title" className="text-sm font-semibold text-ink-muted">
            {t('parsons.answerTitle')}
          </h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={answer} strategy={verticalListSortingStrategy}>
              <ul className="mt-2 flex min-h-[4.5rem] flex-col gap-2 rounded-xl border-2 border-dashed border-line bg-code-bg p-2.5">
                {answer.length === 0 && (
                  <li className="flex flex-1 items-center justify-center px-2 py-3 text-sm text-ink-muted">
                    {t('parsons.answerEmpty')}
                  </li>
                )}
                {answer.map((poolIndex) => {
                  const item = byIndex.get(poolIndex);
                  return item ? (
                    <AnswerRow
                      key={poolIndex}
                      item={item}
                      indent={indentOf(poolIndex)}
                      onRemove={() => removeFromAnswer(poolIndex)}
                      onIndentChange={isChosen ? (delta) => changeIndent(poolIndex, delta) : undefined}
                    />
                  ) : null;
                })}
              </ul>
            </SortableContext>
          </DndContext>
        </section>
      </div>
    </WorkspaceFrame>
  );
}
