'use client';

/**
 * Creates or edits a lesson (docs/TASKS.md, "Teacher-side lesson authoring"):
 * the fields content/lessons/ holds, the Markdown explanation with a preview
 * rendered by the same deck students see (TheoryDeck), and two ordered task
 * lists — core, then additional. Rules are checked server-side by
 * lib/lessons/authoring.ts; the form only reports what came back.
 *
 * Guess cards ("what will it print?") need work here first: before a
 * save the form runs each card's code in the browser, as a task's reference is
 * run before publishing, says plainly which card is wrong and what its code
 * really prints, and sends the runs along for the server to check again
 * (CLAUDE.md rule 5).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { RowButton } from '@/components/authoring/ChecksField';
import { TheoryDeck } from '@/components/lesson/TheoryDeck';
import type { LessonDraft, LessonDraftError } from '@/lib/lessons/authoring';
import { checkGuessRuns, guessShapeProblems, isAnswerable, theoryGuesses, type GuessRun } from '@/lib/lessons/theory';
import type { LessonKind } from '@/lib/lessons/types';
import { createRunner, type PythonRunner } from '@/lib/runner';
import { moveItem } from '@/lib/task/check-form';
import { unsequencedFileTasks } from '@/lib/task/prerequisite';
import type { TaskType } from '@/lib/task/types';
import { t } from '@/lib/i18n';

// Mirrors the server's LessonTaskOption — a client component cannot import the database layer (CLAUDE.md rule 4).
export interface LessonTaskOptionView {
  id: string;
  slug: string;
  title: string;
  type: TaskType;
  status: 'draft' | 'published' | 'archived';
  difficulty: number;
  gradeTags: number[];
  topicTitle: string;
  sessionOnly: boolean;
  topicId: string;
  fileDelivery: boolean;
}

interface LessonFormProps {
  /** Absent for a new lesson. */
  lessonId?: string;
  initial: LessonDraft;
  tasks: LessonTaskOptionView[];
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; errors: string[] };

/** What the three insert buttons put at the cursor: the syntax, shown by example (lib/lessons/markdown.ts). */
const snippet = (kind: 'card' | 'guess' | 'remember') =>
  kind === 'card'
    ? '\n\n---\n\n'
    : `\n\n${t(kind === 'guess' ? 'lessonForm.snippetGuess' : 'lessonForm.snippetRemember')}\n`;

/** Runs every answerable guess's code once, headless, with no input — what a student's screen never does. */
async function runGuesses(runner: PythonRunner, markdown: string): Promise<GuessRun[]> {
  const runs: GuessRun[] = [];
  for (const guess of theoryGuesses(markdown).filter(isAnswerable)) {
    if (runs.some((run) => run.code === guess.code)) continue;
    const result = await runner.run(guess.code, { mode: 'headless' });
    runs.push({ code: guess.code, stdout: result.stdout, failed: Boolean(result.error) || result.timedOut });
  }
  return runs;
}

const insertClass = 'rounded-md border border-line bg-shell px-3 py-1.5 text-sm text-ink hover:border-accent';

const TYPE_LABEL: Record<TaskType, string> = {
  code: 'authoring.taskTypeCode',
  parsons: 'authoring.taskTypeParsons',
  quiz: 'authoring.taskTypeQuiz',
  predict: 'authoring.taskTypePredict',
  fix: 'authoring.taskTypeFix',
  fill: 'authoring.taskTypeFill'
};

export function LessonForm({ lessonId, initial, tasks }: LessonFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<LessonDraft>(initial);
  const [preview, setPreview] = useState(false);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const explanationRef = useRef<HTMLTextAreaElement>(null);
  const runnerRef = useRef<PythonRunner | null>(null);
  useEffect(() => () => runnerRef.current?.dispose(), []);
  const shapeProblems = useMemo(() => guessShapeProblems(draft.explanationMd), [draft.explanationMd]);
  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const chosen = new Set([...draft.coreTaskIds, ...draft.additionalTaskIds]);
  // The sequencing rule for file tasks (lib/task/prerequisite.ts): a warning, never a reason to refuse the save.
  const unsequenced = unsequencedFileTasks(
    [...draft.coreTaskIds, ...draft.additionalTaskIds]
      .map((id) => byId.get(id))
      .filter((task): task is LessonTaskOptionView => task !== undefined)
      .map((task) => ({ ...task, topicKey: task.topicId }))
  );

  function set<K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (state.kind === 'saved') setState({ kind: 'idle' });
  }

  function insert(addition: string) {
    const area = explanationRef.current;
    const at = area?.selectionStart ?? draft.explanationMd.length;
    const text = draft.explanationMd;
    // At the very top nothing needs blank lines — or a card break — before it.
    const piece = text.slice(0, at).trim() === '' ? addition.replace(/^\n+(---\n+)?/, '') : addition;
    set('explanationMd', text.slice(0, at) + piece + text.slice(at));
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(at + piece.length, at + piece.length);
    });
  }

  /** Runs the guesses: the runs to send when every marked answer holds, or what to tell the teacher when one does not. */
  async function checkGuesses(): Promise<{ runs: GuessRun[] } | { errors: string[] }> {
    if (!theoryGuesses(draft.explanationMd).some(isAnswerable)) return { runs: [] };
    runnerRef.current ??= createRunner();
    const runs = await runGuesses(runnerRef.current, draft.explanationMd);
    const reports = checkGuessRuns(draft.explanationMd, runs);
    if (reports.length === 0) return { runs };
    return {
      errors: reports.map((report) =>
        t(`lessonForm.guessRun.${report.problem}`, { n: report.guess, actual: report.actual ?? '' })
      )
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // An empty number field is NaN, which JSON turns into null — say which field instead of sending it.
    const local: LessonDraftError[] = [
      ...(Number.isNaN(draft.grade) ? (['grade'] as const) : []),
      ...(Number.isNaN(draft.order) ? (['order'] as const) : [])
    ];
    if (local.length > 0) {
      setState({ kind: 'error', errors: local.map((code) => t(`lessonForm.errors.${code}`)) });
      return;
    }
    if (shapeProblems.length > 0) {
      setState({ kind: 'error', errors: [t('lessonForm.errors.guessMalformed')] });
      return;
    }
    setState({ kind: 'checking' });
    let guessRuns: GuessRun[];
    try {
      const checked = await checkGuesses();
      if ('errors' in checked) {
        setState({ kind: 'error', errors: checked.errors });
        return;
      }
      guessRuns = checked.runs;
    } catch {
      setState({ kind: 'error', errors: [t('lessonForm.guessEngineError')] });
      return;
    }
    setState({ kind: 'saving' });
    try {
      const response = await fetch(lessonId ? `/api/lessons/${lessonId}` : '/api/lessons', {
        method: lessonId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, guessRuns })
      });
      if (response.status === 400) {
        const data: { errors?: LessonDraftError[] } = await response.json();
        const errors = (data.errors ?? []).map((code) => t(`lessonForm.errors.${code}`));
        setState({ kind: 'error', errors: errors.length > 0 ? errors : [t('lessonForm.saveError')] });
        return;
      }
      if (!response.ok) throw new Error('save failed');
      const data: { id: string } = await response.json();
      if (!lessonId) {
        router.push(`/lessons/${data.id}`);
        return;
      }
      setState({ kind: 'saved' });
      router.refresh();
    } catch {
      setState({ kind: 'error', errors: [t('lessonForm.saveError')] });
    }
  }

  async function handleDelete() {
    if (!lessonId || !window.confirm(t('lessonForm.deleteConfirm', { title: draft.title }))) return;
    const response = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
    if (response.ok) router.push('/lessons');
    else setState({ kind: 'error', errors: [t('lessonForm.saveError')] });
  }

  const moveBetween = (id: string, from: 'coreTaskIds' | 'additionalTaskIds') => {
    const to = from === 'coreTaskIds' ? 'additionalTaskIds' : 'coreTaskIds';
    setDraft((previous) => ({
      ...previous,
      [from]: previous[from].filter((existing) => existing !== id),
      [to]: [...previous[to], id]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="lesson-grade" label={t('lessonForm.grade')}>
          <input
            id="lesson-grade"
            type="number"
            min={1}
            max={12}
            value={Number.isNaN(draft.grade) ? '' : draft.grade}
            onChange={(event) => set('grade', event.target.valueAsNumber)}
            className={inputClass}
          />
        </Field>
        <Field id="lesson-order" label={t('lessonForm.order')} hint={t('lessonForm.orderHint')}>
          <input
            id="lesson-order"
            type="number"
            min={1}
            value={Number.isNaN(draft.order) ? '' : draft.order}
            onChange={(event) => set('order', event.target.valueAsNumber)}
            className={inputClass}
          />
        </Field>
        <Field id="lesson-ref" label={t('lessonForm.curriculumRef')} hint={t('lessonForm.curriculumRefHint')}>
          <input
            id="lesson-ref"
            value={draft.curriculumRef ?? ''}
            onChange={(event) => set('curriculumRef', event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field id="lesson-title" label={t('lessonForm.title')}>
        <input
          id="lesson-title"
          value={draft.title}
          onChange={(event) => set('title', event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field id="lesson-slug" label={t('lessonForm.slug')} hint={t(lessonId ? 'lessonForm.slugFixed' : 'authoring.slugHint')}>
        <input
          id="lesson-slug"
          value={draft.slug}
          onChange={(event) => set('slug', event.target.value)}
          readOnly={Boolean(lessonId)}
          className={`${inputClass} font-mono ${lessonId ? 'text-ink-muted' : ''}`}
        />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm text-ink-muted">{t('lessonForm.kind')}</legend>
        {(['mandatory', 'practice'] as const satisfies readonly LessonKind[]).map((kind) => (
          <label key={kind} className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="lesson-kind"
              checked={draft.kind === kind}
              onChange={() => set('kind', kind)}
              className="mt-1"
            />
            <span>
              {kind === 'mandatory' ? t('lessons.kindMandatory') : t('lessons.kindPractice')}
              <span className="block text-xs text-ink-muted">
                {kind === 'mandatory' ? t('lessonForm.mandatoryNote') : t('lessonForm.practiceNote')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="lesson-explanation" className="text-sm text-ink-muted">
            {t('lessonForm.explanation')}
          </label>
          <button type="button" onClick={() => setPreview((value) => !value)} className="text-xs text-accent">
            {preview ? t('lessonForm.hidePreview') : t('lessonForm.showPreview')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('lessonForm.insertLabel')}>
          <button type="button" onClick={() => insert(snippet('card'))} className={insertClass}>
            {t('lessonForm.insertCard')}
          </button>
          <button type="button" onClick={() => insert(snippet('guess'))} className={insertClass}>
            {t('lessonForm.insertGuess')}
          </button>
          <button type="button" onClick={() => insert(snippet('remember'))} className={insertClass}>
            {t('lessonForm.insertRemember')}
          </button>
        </div>
        <textarea
          ref={explanationRef}
          id="lesson-explanation"
          rows={14}
          value={draft.explanationMd}
          onChange={(event) => set('explanationMd', event.target.value)}
          spellCheck={false}
          className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
        />
        <p className="text-xs text-ink-muted">{t('lessonForm.explanationHint')}</p>
        <p className="text-xs text-ink-muted">{t('lessonForm.guessHint')}</p>
        {shapeProblems.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md border-l-4 border-attention bg-surface px-3 py-2 text-sm text-ink" data-testid="guess-problems">
            {shapeProblems.map(({ guess, problem }) => (
              <li key={`${guess}:${problem}`}>{t(`lessonForm.guessProblem.${problem}`, { n: guess })}</li>
            ))}
          </ul>
        )}
        {preview && (
          <section
            aria-label={t('lessonForm.preview')}
            className="rounded-md border border-dashed border-line bg-shell p-3"
          >
            <TheoryDeck markdown={draft.explanationMd} />
          </section>
        )}
      </div>

      <TaskList
        heading={t('lessons.coreTasks')}
        note={t('lessonForm.coreNote')}
        listKey="coreTaskIds"
        ids={draft.coreTaskIds}
        byId={byId}
        tasks={tasks}
        chosen={chosen}
        grade={draft.grade}
        onChange={(ids) => set('coreTaskIds', ids)}
        onMoveAcross={(id) => moveBetween(id, 'coreTaskIds')}
        moveAcrossLabel={t('lessonForm.toAdditional')}
      />
      <TaskList
        heading={t('lessons.additionalTasks')}
        note={t('lessonForm.additionalNote')}
        listKey="additionalTaskIds"
        ids={draft.additionalTaskIds}
        byId={byId}
        tasks={tasks}
        chosen={chosen}
        grade={draft.grade}
        onChange={(ids) => set('additionalTaskIds', ids)}
        onMoveAcross={(id) => moveBetween(id, 'additionalTaskIds')}
        moveAcrossLabel={t('lessonForm.toCore')}
      />

      {unsequenced.length > 0 && (
        <div role="status" data-testid="file-unsequenced" className="rounded-md border border-attention p-3 text-sm text-ink">
          <p>{t('lessonForm.fileUnsequencedTitle')}</p>
          <ul className="mt-2 list-disc pl-5">
            {unsequenced.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
          <p className="mt-2 text-ink-muted">{t('lessonForm.fileUnsequencedNote')}</p>
        </div>
      )}

      {state.kind === 'error' && (
        <ul role="alert" className="list-disc pl-5 text-sm text-attention">
          {state.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state.kind === 'saving' || state.kind === 'checking'}
          className="rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {state.kind === 'checking' ? t('lessonForm.checkingGuesses') : state.kind === 'saving' ? t('authoring.saving') : lessonId ? t('lessonForm.save') : t('lessonForm.create')}
        </button>
        {state.kind === 'saved' && <span className="text-sm text-growth">{t('lessonForm.saved')}</span>}
        {lessonId && (
          <>
            <Link href={`/practice/${initial.slug}`} className="text-sm text-accent">
              {t('lessonForm.openAsStudent')}
            </Link>
            <button type="button" onClick={handleDelete} className="ml-auto text-sm text-attention">
              {t('lessonForm.delete')}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

const inputClass = 'rounded-md border border-line bg-surface px-3 py-2 text-ink';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function TaskList({
  heading,
  note,
  listKey,
  ids,
  byId,
  tasks,
  chosen,
  grade,
  onChange,
  onMoveAcross,
  moveAcrossLabel
}: {
  heading: string;
  note: string;
  listKey: string;
  ids: string[];
  byId: ReadonlyMap<string, LessonTaskOptionView>;
  tasks: LessonTaskOptionView[];
  chosen: ReadonlySet<string>;
  grade: number;
  onChange: (ids: string[]) => void;
  onMoveAcross: (id: string) => void;
  moveAcrossLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [allGrades, setAllGrades] = useState(false);
  const [pick, setPick] = useState('');
  const needle = query.trim().toLowerCase();
  const options = tasks.filter(
    (task) =>
      !chosen.has(task.id) &&
      (allGrades || task.gradeTags.length === 0 || task.gradeTags.includes(grade)) &&
      (needle === '' ||
        task.title.toLowerCase().includes(needle) ||
        task.slug.includes(needle) ||
        task.topicTitle.toLowerCase().includes(needle))
  );
  const selected = options.some((task) => task.id === pick) ? pick : (options[0]?.id ?? '');

  return (
    <section aria-labelledby={`${listKey}-heading`} className="flex flex-col gap-2">
      <div>
        <h2 id={`${listKey}-heading`} className="text-base font-semibold text-ink">
          {heading}
        </h2>
        <p className="text-xs text-ink-muted">{note}</p>
      </div>
      {ids.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('lessonForm.noTasks')}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {ids.map((id, index) => {
            const task = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <span className="w-6 text-xs text-ink-muted">{index + 1}.</span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm text-ink">{task?.title ?? t('lessonForm.missingTask')}</span>
                  {task && (
                    <span className="text-xs text-ink-muted">
                      {task.topicTitle} · {t(TYPE_LABEL[task.type])} · {t('lessons.difficulty', { n: task.difficulty })}
                      {task.status === 'draft' && ` · ${t('lessonForm.draftBadge')}`}
                      {task.sessionOnly && ` · ${t('lessons.sessionOnly')}`}
                    </span>
                  )}
                </span>
                <span className="flex gap-1 text-xs">
                  <RowButton label={t('builder.moveUp')} disabled={index === 0} onClick={() => onChange(moveItem(ids, index, index - 1))}>
                    ↑
                  </RowButton>
                  <RowButton
                    label={t('builder.moveDown')}
                    disabled={index === ids.length - 1}
                    onClick={() => onChange(moveItem(ids, index, index + 1))}
                  >
                    ↓
                  </RowButton>
                  <RowButton label={moveAcrossLabel} onClick={() => onMoveAcross(id)}>
                    ⇄
                  </RowButton>
                  <RowButton label={t('builder.remove')} onClick={() => onChange(ids.filter((existing) => existing !== id))}>
                    ✕
                  </RowButton>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('lessonForm.searchPlaceholder')}
          aria-label={t('lessonForm.search', { list: heading })}
          className="w-48 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        />
        <select
          value={selected}
          onChange={(event) => setPick(event.target.value)}
          aria-label={t('lessonForm.pick', { list: heading })}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
        >
          {options.length === 0 && <option value="">{t('lessonForm.noMatches')}</option>}
          {options.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} — {task.topicTitle}
              {task.status === 'draft' ? ` (${t('lessonForm.draftBadge')})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={selected === ''}
          onClick={() => onChange([...ids, selected])}
          className="rounded-md border border-accent px-3 py-1.5 text-sm text-accent disabled:opacity-50"
        >
          {t('lessonForm.addTask')}
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input type="checkbox" checked={allGrades} onChange={(event) => setAllGrades(event.target.checked)} />
        {t('lessonForm.allGrades', { grade: Number.isNaN(grade) ? '' : grade })}
      </label>
    </section>
  );
}
