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
import { Hints } from '@/components/task/Hints';
import { t } from '@/lib/i18n';
import { parsonsPool, type ParsonsPoolItem } from '@/lib/task/parsons';
import type { AttemptOutcome, ParsonsTask } from '@/lib/task/types';

interface ParsonsTaskViewProps {
  task: ParsonsTask;
  onSubmitAttempt?: (outcome: AttemptOutcome) => void;
  hintsEnabled?: boolean;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function BankRow({ item, onAdd }: { item: ParsonsPoolItem; onAdd: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink">
      <span>{item.text}</span>
      <button type="button" onClick={onAdd} className="shrink-0 text-xs text-accent">
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
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: `${1 + indent * 1.5}rem`
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface py-2 pr-3 font-mono text-sm text-ink"
    >
      <span className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('parsons.dragHandle')}
          className="cursor-grab text-ink-muted"
        >
          ⠿
        </button>
        {item.text}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {onIndentChange && (
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <button
              type="button"
              onClick={() => onIndentChange(-1)}
              disabled={indent === 0}
              aria-label={t('parsons.indentOut')}
              className="disabled:opacity-30"
            >
              ←
            </button>
            <span aria-live="polite">{t('parsons.indentLabel', { level: indent })}</span>
            <button type="button" onClick={() => onIndentChange(1)} aria-label={t('parsons.indentIn')}>
              →
            </button>
          </span>
        )}
        <button type="button" onClick={onRemove} className="text-xs text-accent">
          {t('parsons.remove')}
        </button>
      </span>
    </li>
  );
}

export function ParsonsTaskView({ task, onSubmitAttempt, hintsEnabled = true }: ParsonsTaskViewProps) {
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
    <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
      <section>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('task.statement')}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{task.title}</h1>
        <p className="mt-2 text-ink">{task.payload.prompt}</p>
        <Hints hints={hintsEnabled ? task.hints : []} onReveal={() => (hintsUsedRef.current += 1)} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">{t('parsons.bankTitle')}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {bank.length === 0 && <li className="text-sm text-ink-muted">{t('parsons.bankEmpty')}</li>}
            {bank.map((poolIndex) => {
              const item = byIndex.get(poolIndex);
              return item ? <BankRow key={poolIndex} item={item} onAdd={() => addToAnswer(poolIndex)} /> : null;
            })}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">{t('parsons.answerTitle')}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={answer} strategy={verticalListSortingStrategy}>
              <ul className="mt-2 flex min-h-[3rem] flex-col gap-1.5 rounded-md border border-dashed border-line p-2">
                {answer.length === 0 && <li className="px-2 text-sm text-ink-muted">{t('parsons.answerEmpty')}</li>}
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
        </div>

        <button
          type="button"
          onClick={check}
          disabled={answer.length === 0}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {t('workspace.check')}
        </button>

        {report && (
          <section
            className={`rounded-md border-l-4 ${report.passed ? 'border-growth' : 'border-attention'} bg-surface p-4`}
            aria-live="polite"
          >
            <h3
              className={`flex items-center gap-2 font-semibold ${report.passed ? 'text-growth' : 'text-attention'}`}
            >
              <span aria-hidden="true">{report.passed ? '✓' : '○'}</span>
              {report.passed ? t('result.passed') : t('result.notYet')}
            </h3>
            <div className="mt-1 text-sm text-ink">
              {report.passed ? (
                <p>{t('result.passedNote')}</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {report.results
                      .filter((r) => !r.passed)
                      .map((r, index) => (
                        <li key={`${r.check.kind}-${index}`}>{r.message}</li>
                      ))}
                  </ul>
                  <p className="mt-2 text-ink-muted">{t('result.notYetNote')}</p>
                </>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
