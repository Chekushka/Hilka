'use client';

/**
 * Creates a session: pick a class, filter the published task catalog by
 * topic and grade, choose which tasks to assign (in click order — that
 * order becomes `sessions.task_ids`, the order a student meets them in),
 * and set the graded-session knobs (docs/TASKS.md, "Session builder").
 *
 * The task catalog is small enough today (a handful of seed tasks) that
 * filtering happens client-side against the full published list rather than
 * a separate filtered query per topic/grade change.
 *
 * Laid out as the mockups' session builder: settings and filters on the
 * left, the task bank in the middle, the chosen tasks — in the order
 * students meet them, reorderable — with the create button on the right.
 *
 * A whole lesson can be added at once (core, then additional tasks). In
 * graded mode the form warns — without blocking — about any chosen task that
 * is not a core task of a mandatory lesson (docs/AI_CONTEXT.md, "Grading").
 *
 * The third mode is homework (docs/HOMEWORK.md): graded, with a deadline in
 * place of a time limit, and any chosen task can be marked as an improvement
 * task — offered only to students who lost points.
 */
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { DEFAULT_GRADING } from '@/lib/grading/config';
import { formatDeadline } from '@/lib/homework/deadline';
import { t } from '@/lib/i18n';
import { addLessonToSelection, findNonGradedTasks } from '@/lib/lessons/graded-warnings';
import { unsequencedFileTasks } from '@/lib/task/prerequisite';
import type { LessonKind } from '@/lib/lessons/types';
import type { SessionMode } from '@/lib/session/types';
import type { TaskType } from '@/lib/task/types';

// Mirrors the database layer's shapes rather than importing them — the
// database is off-limits to a client component, even for a type (CLAUDE.md
// rule 4).
interface ClassOption {
  id: string;
  title: string;
  grade: number | null;
}

interface TaskOption {
  id: string;
  slug: string;
  title: string;
  topicSlug: string;
  topicTitle: string;
  gradeTags: number[];
  difficulty: number;
  type: TaskType;
  fileDelivery: boolean;
  parameterized: boolean;
}

interface LessonOption {
  id: string;
  grade: number;
  order: number;
  kind: LessonKind;
  title: string;
  coreTaskIds: string[];
  additionalTaskIds: string[];
}

interface SessionBuilderFormProps {
  classes: ClassOption[];
  /** The class to start on (`/sessions/new?class=`), when it is one of `classes`. */
  initialClassId?: string;
  tasks: TaskOption[];
  lessons: LessonOption[];
}

const ALL_TOPICS = '';
const ALL_GRADES = '';

type BuilderMode = SessionMode | 'homework';

const pad = (n: number) => String(n).padStart(2, '0');

/** `days` from today at 18:00 on this computer's clock, as a datetime-local value. */
function deadlineInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T18:00`;
}

const DEADLINE_PRESETS = [
  { days: 1, label: 'sessionBuilder.duePresetTomorrow' },
  { days: 3, label: 'sessionBuilder.duePresetThreeDays' },
  { days: 7, label: 'sessionBuilder.duePresetWeek' }
] as const;

const percent = (share: number) => Math.round(share * 100);

/** The task bank's grade filter for a class: its grade, when it has one and some task carries it. */
function gradeFilterFor(klass: ClassOption | undefined, gradeOptions: readonly number[]): string {
  return klass?.grade && gradeOptions.includes(klass.grade) ? String(klass.grade) : ALL_GRADES;
}

export function SessionBuilderForm({ classes, initialClassId, tasks, lessons }: SessionBuilderFormProps) {
  const startClass = classes.find((klass) => klass.id === initialClassId) ?? classes[0];
  const [classId, setClassId] = useState(startClass?.id ?? '');
  const [mode, setMode] = useState<BuilderMode>('practice');
  // datetime-local, on the teacher's own clock; set when homework is chosen, so the server never renders a time.
  const [dueAt, setDueAt] = useState('');
  const [improvementIds, setImprovementIds] = useState<string[]>([]);
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS);
  const gradeOptions = [...new Set(tasks.flatMap((task) => task.gradeTags))].sort((a, b) => a - b);
  // The bank opens on the class's grade (set on the class form); the teacher can widen it.
  const [gradeFilter, setGradeFilter] = useState(() => gradeFilterFor(startClass, gradeOptions));
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  // Each student gets this many of the chosen tasks (lib/seed/assignment.ts); empty for all.
  const [poolSize, setPoolSize] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [lessonToAdd, setLessonToAdd] = useState('');
  const [search, setSearch] = useState('');

  const topicOptions = [...new Map(tasks.map((task) => [task.topicSlug, task.topicTitle])).entries()];

  const query = search.trim().toLocaleLowerCase('uk');
  const visibleTasks = tasks.filter(
    (task) =>
      (topicFilter === ALL_TOPICS || task.topicSlug === topicFilter) &&
      (gradeFilter === ALL_GRADES || task.gradeTags.includes(Number(gradeFilter))) &&
      (query === '' || task.title.toLocaleLowerCase('uk').includes(query))
  );

  function toggleTask(id: string) {
    setSelectedTaskIds((previous) =>
      previous.includes(id) ? previous.filter((existing) => existing !== id) : [...previous, id]
    );
  }

  function moveTask(id: string, step: -1 | 1) {
    setSelectedTaskIds((previous) => {
      const from = previous.indexOf(id);
      const to = from + step;
      if (from < 0 || to < 0 || to >= previous.length) return previous;
      const next = [...previous];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  function addLesson() {
    const lesson = lessons.find((candidate) => candidate.id === lessonToAdd);
    if (!lesson) return;
    const assignable = new Set(tasks.map((task) => task.id));
    setSelectedTaskIds((previous) => addLessonToSelection(previous, lesson, assignable));
  }

  const titlesById = new Map(tasks.map((task) => [task.id, task.title]));
  const homework = mode === 'homework';
  // Homework is graded too; an improvement task is extra by design and never warned about.
  const nonGraded =
    mode === 'graded' || homework
      ? findNonGradedTasks(
          selectedTaskIds.filter((id) => !(homework && improvementIds.includes(id))),
          lessons
        )
      : [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  // The sequencing rule for file tasks (lib/task/prerequisite.ts), in the order students meet them. A warning only.
  const unsequenced = unsequencedFileTasks(
    selectedTaskIds
      .map((id) => tasksById.get(id))
      .filter((task): task is TaskOption => task !== undefined)
      .map((task) => ({ ...task, topicKey: task.topicSlug }))
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!classId) {
      setError(t('sessionBuilder.noClass'));
      return;
    }
    const improvement = homework ? selectedTaskIds.filter((id) => improvementIds.includes(id)) : [];
    const main = selectedTaskIds.filter((id) => !improvement.includes(id));
    if (main.length === 0) {
      setError(t('sessionBuilder.noTasks'));
      return;
    }
    const due = homework && dueAt ? new Date(dueAt) : null;
    if (homework && (due === null || Number.isNaN(due.getTime()))) {
      setError(t('sessionBuilder.noDeadline'));
      return;
    }

    setSaving(true);
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId,
        mode: homework ? 'graded' : mode,
        kind: homework ? 'homework' : 'lesson',
        taskIds: main,
        improvementTaskIds: improvement,
        timeLimitS: !homework && timeLimitMinutes ? Number(timeLimitMinutes) * 60 : null,
        hintsEnabled,
        shuffle,
        poolSize: poolSize && Number(poolSize) < main.length ? Number(poolSize) : null,
        dueAt: due ? due.toISOString() : null
      })
    });

    if (!response.ok) {
      setSaving(false);
      setError(t('sessionBuilder.createError'));
      return;
    }

    const data: { id: string; code: string } = await response.json();
    setSaving(false);
    setCreated(data);
  }

  if (created) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-ink">{t('sessionBuilder.created')}</p>
        <p className="mt-3 font-mono text-2xl font-semibold tracking-[0.2em] text-ink md:text-5xl">{created.code}</p>
        {homework && dueAt && (
          <p className="mt-3 text-ink">
            {t('sessionBuilder.createdDue', { date: formatDeadline(new Date(dueAt).toISOString()) })}
          </p>
        )}
        <p className="mt-4 text-sm text-ink-muted">{t('sessionBuilder.createdHint')}</p>
        <a
          href={`/dashboard/sessions/${created.id}`}
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface"
        >
          {t('sessionBuilder.viewSession')}
        </a>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <p className="mt-6 text-ink-muted">
        {t('sessionBuilder.noClasses')}{' '}
        <Link href="/classes/new" className="text-accent">
          {t('classForm.newClass')}
        </Link>
      </p>
    );
  }

  const fieldClass = 'rounded-lg border border-line bg-surface px-3 py-2 text-ink';
  const labelClass = 'text-sm text-ink-muted';
  const panelClass =
    'flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto';
  const selected = selectedTaskIds
    .map((id) => tasksById.get(id))
    .filter((task): task is TaskOption => task !== undefined);
  const minutes = timeLimitMinutes === '' ? null : Number(timeLimitMinutes);
  const mainCount = selectedTaskIds.filter((id) => !(homework && improvementIds.includes(id))).length;

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
      <div className={panelClass}>
        <h2 className="text-sm font-semibold text-ink">{t('sessionBuilder.settingsTitle')}</h2>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="class">
            {t('sessionBuilder.classLabel')}
          </label>
          <select
            id="class"
            required
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              const klass = classes.find((option) => option.id === event.target.value);
              if (klass?.grade) setGradeFilter(gradeFilterFor(klass, gradeOptions));
            }}
            className={fieldClass}
          >
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="mode">
            {t('sessionBuilder.modeLabel')}
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(event) => {
              const next = event.target.value as BuilderMode;
              setMode(next);
              if (next === 'homework' && !dueAt) setDueAt(deadlineInDays(3));
            }}
            className={fieldClass}
          >
            <option value="practice">{t('sessionBuilder.modePractice')}</option>
            <option value="graded">{t('sessionBuilder.modeGraded')}</option>
            <option value="homework">{t('sessionBuilder.modeHomework')}</option>
          </select>
        </div>

        {homework && (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="dueAt">
              {t('sessionBuilder.dueLabel')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEADLINE_PRESETS.map((preset) => {
                const value = deadlineInDays(preset.days);
                return (
                  <button
                    key={preset.days}
                    type="button"
                    aria-pressed={dueAt === value}
                    onClick={() => setDueAt(value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                      dueAt === value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t(preset.label)}
                  </button>
                );
              })}
            </div>
            <input
              id="dueAt"
              type="datetime-local"
              required
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={`w-full ${fieldClass}`}
            />
            <p className="text-xs leading-relaxed text-ink-muted" data-testid="homework-rules">
              {t('sessionBuilder.homeworkRules', {
                fixes: DEFAULT_GRADING.maxFixes,
                fixCredit: percent(DEFAULT_GRADING.fixCredit),
                days: Math.round(DEFAULT_GRADING.lateSteps[0].withinHours / 24),
                early: percent(DEFAULT_GRADING.lateSteps[0].credit),
                late: percent(DEFAULT_GRADING.lateCreditBeyond)
              })}
            </p>
          </div>
        )}

        <div className={`flex flex-col gap-1.5 ${homework ? 'hidden' : ''}`}>
          <label className={labelClass} htmlFor="timeLimit">
            {t('sessionBuilder.timeLimitLabel')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[15, 25, 45, null].map((preset) => {
              const active = preset === minutes;
              return (
                <button
                  key={preset ?? 'none'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTimeLimitMinutes(preset === null ? '' : String(preset))}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm tabular-nums ${
                    active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  {preset === null
                    ? t('sessionBuilder.timePresetNone')
                    : t('sessionBuilder.timePresetMinutes', { n: preset })}
                </button>
              );
            })}
          </div>
          <input
            id="timeLimit"
            type="number"
            min={1}
            placeholder={t('sessionBuilder.timeLimitPlaceholder')}
            value={timeLimitMinutes}
            onChange={(event) => setTimeLimitMinutes(event.target.value)}
            className={`w-full ${fieldClass}`}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={hintsEnabled} onChange={(event) => setHintsEnabled(event.target.checked)} />
          {t('sessionBuilder.hintsEnabledLabel')}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
          {t('sessionBuilder.shuffleLabel')}
        </label>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="poolSize">
            {t('sessionBuilder.poolLabel')}
          </label>
          <input
            id="poolSize"
            type="number"
            min={1}
            placeholder={t('sessionBuilder.poolPlaceholder')}
            value={poolSize}
            onChange={(event) => setPoolSize(event.target.value)}
            className={`w-full ${fieldClass}`}
          />
          {poolSize !== '' && Number(poolSize) > 0 && Number(poolSize) < mainCount && (
            <p className="text-xs text-ink-muted" data-testid="pool-note">
              {t('sessionBuilder.poolNote', { k: Number(poolSize), n: mainCount })}
            </p>
          )}
        </div>

        {lessons.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-4">
            <label className={labelClass} htmlFor="lessonToAdd">
              {t('sessionBuilder.lessonLabel')}
            </label>
            <select
              id="lessonToAdd"
              value={lessonToAdd}
              onChange={(event) => setLessonToAdd(event.target.value)}
              className={`min-w-0 ${fieldClass}`}
            >
              <option value="">{t('sessionBuilder.lessonPlaceholder')}</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {t('sessionBuilder.lessonOption', {
                    grade: lesson.grade,
                    order: lesson.order,
                    title: lesson.title,
                    kind: lesson.kind === 'mandatory' ? t('lessons.kindMandatory') : t('lessons.kindPractice')
                  })}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addLesson}
              disabled={!lessonToAdd}
              className="self-start rounded-lg border border-accent px-3 py-1.5 text-sm text-accent disabled:opacity-50"
            >
              {t('sessionBuilder.addLesson')}
            </button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-lg font-semibold text-ink">{t('sessionBuilder.filtersTitle')}</h2>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="taskSearch">
              {t('sessionBuilder.searchLabel')}
            </label>
            <input
              id="taskSearch"
              type="search"
              value={search}
              placeholder={t('sessionBuilder.searchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
              className={`w-44 ${fieldClass}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="topicFilter">
              {t('sessionBuilder.topicFilterLabel')}
            </label>
            <select
              id="topicFilter"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className={`max-w-[14rem] ${fieldClass}`}
            >
              <option value={ALL_TOPICS}>{t('sessionBuilder.filterAll')}</option>
              {topicOptions.map(([slug, title]) => (
                <option key={slug} value={slug}>
                  {title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="gradeFilter">
              {t('sessionBuilder.gradeFilterLabel')}
            </label>
            <select
              id="gradeFilter"
              value={gradeFilter}
              onChange={(event) => setGradeFilter(event.target.value)}
              className={fieldClass}
            >
              <option value={ALL_GRADES}>{t('sessionBuilder.filterAll')}</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          {t('sessionBuilder.bankShown', { shown: visibleTasks.length, total: tasks.length })}
        </p>

        {visibleTasks.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('sessionBuilder.noMatchingTasks')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleTasks.map((task) => {
              const checked = selectedTaskIds.includes(task.id);
              return (
                <li key={task.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 ${
                      checked ? 'border-accent' : 'border-line hover:border-ink-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      checked={checked}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{task.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {t('sessionBuilder.taskMeta', {
                          grades: task.gradeTags.join(', '),
                          topic: task.topicTitle,
                          difficulty: task.difficulty
                        })}
                        {task.fileDelivery && ` · ${t('sessionBuilder.fileTask')}`}
                        {task.parameterized && ` · ${t('sessionBuilder.variantTask')}`}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-shell px-2.5 py-1 text-xs text-ink-muted">
                      {t(`task.types.${task.type}`)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={panelClass}>
        <h2 className="text-sm font-semibold text-ink">
          {t('sessionBuilder.chosenTitle')} · {t('sessionBuilder.selectedCount', { n: selectedTaskIds.length })}
        </h2>
        {selected.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('sessionBuilder.chosenEmpty')}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {selected.map((task, index) => (
              <li key={task.id} className="flex items-center gap-2 rounded-lg bg-shell px-2.5 py-2">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-muted">{index + 1}</span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-ink">
                  {task.title}
                  {homework && (
                    <button
                      type="button"
                      aria-pressed={improvementIds.includes(task.id)}
                      aria-label={t('sessionBuilder.improvementToggle', { title: task.title })}
                      title={t('sessionBuilder.improvementToggleHint')}
                      onClick={() =>
                        setImprovementIds((previous) =>
                          previous.includes(task.id) ? previous.filter((id) => id !== task.id) : [...previous, task.id]
                        )
                      }
                      className={`mt-1 block rounded-full border px-2 py-0.5 text-xs ${
                        improvementIds.includes(task.id)
                          ? 'border-honey bg-honey/15 text-ink'
                          : 'border-line text-ink-muted hover:text-ink'
                      }`}
                    >
                      {t('sessionBuilder.improvementChip')}
                    </button>
                  )}
                </span>
                <span className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => moveTask(task.id, -1)}
                    disabled={index === 0}
                    aria-label={t('sessionBuilder.moveUp', { title: task.title })}
                    className="h-7 w-7 rounded text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTask(task.id, 1)}
                    disabled={index === selected.length - 1}
                    aria-label={t('sessionBuilder.moveDown', { title: task.title })}
                    className="h-7 w-7 rounded text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    aria-label={t('sessionBuilder.remove', { title: task.title })}
                    className="h-7 w-7 rounded text-ink-muted hover:text-attention"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}

        {homework && selected.length > 0 && (
          <p className="text-xs leading-relaxed text-ink-muted">{t('sessionBuilder.improvementHint')}</p>
        )}
        {selected.length > 0 && (
          <p className="text-xs leading-relaxed text-ink-muted" data-testid="variant-count">
            {t('sessionBuilder.variantCount', {
              k: selected.filter((task) => task.parameterized).length,
              n: selected.length
            })}
          </p>
        )}

        {nonGraded.length > 0 && (
          <div role="alert" className="rounded-lg border border-attention p-3 text-sm text-ink">
            <p>{t('sessionBuilder.gradedWarningTitle')}</p>
            <ul className="mt-2 list-disc pl-5">
              {nonGraded.map((entry) => (
                <li key={entry.taskId}>
                  {titlesById.get(entry.taskId) ?? entry.taskId} —{' '}
                  {entry.reason === 'additional'
                    ? t('sessionBuilder.gradedWarningAdditional')
                    : t('sessionBuilder.gradedWarningPractice')}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-ink-muted">{t('sessionBuilder.gradedWarningNote')}</p>
          </div>
        )}

        {unsequenced.length > 0 && (
          <div
            role="status"
            data-testid="file-unsequenced"
            className="rounded-lg border border-attention p-3 text-sm text-ink"
          >
            <p>{t('sessionBuilder.fileUnsequencedTitle')}</p>
            <ul className="mt-2 list-disc pl-5">
              {unsequenced.map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
            </ul>
            <p className="mt-2 text-ink-muted">{t('sessionBuilder.fileUnsequencedNote')}</p>
          </div>
        )}

        {error && <p className="text-sm text-attention">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-surface disabled:opacity-50"
        >
          {saving ? t('sessionBuilder.creating') : t('sessionBuilder.create')}
        </button>
      </div>
    </form>
  );
}
