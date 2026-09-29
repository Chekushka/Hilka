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
 */
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
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
  tasks: TaskOption[];
  lessons: LessonOption[];
}

const ALL_TOPICS = '';
const ALL_GRADES = '';

export function SessionBuilderForm({ classes, tasks, lessons }: SessionBuilderFormProps) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [mode, setMode] = useState<SessionMode>('practice');
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS);
  const [gradeFilter, setGradeFilter] = useState(ALL_GRADES);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [lessonToAdd, setLessonToAdd] = useState('');
  const [search, setSearch] = useState('');

  const topicOptions = [...new Map(tasks.map((task) => [task.topicSlug, task.topicTitle])).entries()];
  const gradeOptions = [...new Set(tasks.flatMap((task) => task.gradeTags))].sort((a, b) => a - b);

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
  const nonGraded = mode === 'graded' ? findNonGradedTasks(selectedTaskIds, lessons) : [];
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
    if (selectedTaskIds.length === 0) {
      setError(t('sessionBuilder.noTasks'));
      return;
    }

    setSaving(true);
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId,
        mode,
        taskIds: selectedTaskIds,
        timeLimitS: timeLimitMinutes ? Number(timeLimitMinutes) * 60 : null,
        hintsEnabled,
        shuffle
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
            onChange={(event) => setClassId(event.target.value)}
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
            onChange={(event) => setMode(event.target.value as SessionMode)}
            className={fieldClass}
          >
            <option value="practice">{t('sessionBuilder.modePractice')}</option>
            <option value="graded">{t('sessionBuilder.modeGraded')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
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
                <span className="min-w-0 flex-1 text-sm leading-snug text-ink">{task.title}</span>
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
