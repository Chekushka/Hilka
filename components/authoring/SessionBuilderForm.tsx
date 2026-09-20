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
 */
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';
import type { SessionMode } from '@/lib/session/types';

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
}

interface SessionBuilderFormProps {
  classes: ClassOption[];
  tasks: TaskOption[];
}

const ALL_TOPICS = '';
const ALL_GRADES = '';

export function SessionBuilderForm({ classes, tasks }: SessionBuilderFormProps) {
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

  const topicOptions = [...new Map(tasks.map((task) => [task.topicSlug, task.topicTitle])).entries()];
  const gradeOptions = [...new Set(tasks.flatMap((task) => task.gradeTags))].sort((a, b) => a - b);

  const visibleTasks = tasks.filter(
    (task) =>
      (topicFilter === ALL_TOPICS || task.topicSlug === topicFilter) &&
      (gradeFilter === ALL_GRADES || task.gradeTags.includes(Number(gradeFilter)))
  );

  function toggleTask(id: string) {
    setSelectedTaskIds((previous) =>
      previous.includes(id) ? previous.filter((existing) => existing !== id) : [...previous, id]
    );
  }

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
      <div className="mt-6">
        <p className="text-ink">{t('sessionBuilder.created')}</p>
        <p className="mt-2 font-mono text-2xl tracking-wide text-ink">{created.code}</p>
        <a href={`/dashboard/sessions/${created.id}`} className="mt-4 inline-block text-sm text-accent">
          {t('sessionBuilder.viewSession')}
        </a>
      </div>
    );
  }

  if (classes.length === 0) {
    return <p className="mt-6 text-ink-muted">{t('sessionBuilder.noClasses')}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="class">
          {t('sessionBuilder.classLabel')}
        </label>
        <select
          id="class"
          required
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        >
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="mode">
          {t('sessionBuilder.modeLabel')}
        </label>
        <select
          id="mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as SessionMode)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        >
          <option value="practice">{t('sessionBuilder.modePractice')}</option>
          <option value="graded">{t('sessionBuilder.modeGraded')}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="topicFilter">
            {t('sessionBuilder.topicFilterLabel')}
          </label>
          <select
            id="topicFilter"
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          >
            <option value={ALL_TOPICS}>{t('sessionBuilder.filterAll')}</option>
            {topicOptions.map(([slug, title]) => (
              <option key={slug} value={slug}>
                {title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="gradeFilter">
            {t('sessionBuilder.gradeFilterLabel')}
          </label>
          <select
            id="gradeFilter"
            value={gradeFilter}
            onChange={(event) => setGradeFilter(event.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
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

      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-ink-muted">
          {t('sessionBuilder.tasksLabel')} ({t('sessionBuilder.selectedCount', { n: selectedTaskIds.length })})
        </p>
        {visibleTasks.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('sessionBuilder.noMatchingTasks')}</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-md border border-line p-2">
            {visibleTasks.map((task) => (
              <li key={task.id}>
                <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-code-bg">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span>{task.title}</span>
                  <span className="text-xs text-ink-muted">
                    {task.topicTitle} · {task.gradeTags.join(', ')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="timeLimit">
            {t('sessionBuilder.timeLimitLabel')}
          </label>
          <input
            id="timeLimit"
            type="number"
            min={1}
            placeholder={t('sessionBuilder.timeLimitPlaceholder')}
            value={timeLimitMinutes}
            onChange={(event) => setTimeLimitMinutes(event.target.value)}
            className="w-32 rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
        </div>

        <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
          <input type="checkbox" checked={hintsEnabled} onChange={(event) => setHintsEnabled(event.target.checked)} />
          {t('sessionBuilder.hintsEnabledLabel')}
        </label>

        <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
          <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
          {t('sessionBuilder.shuffleLabel')}
        </label>
      </div>

      {error && <p className="text-sm text-attention">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {saving ? t('sessionBuilder.creating') : t('sessionBuilder.create')}
      </button>
    </form>
  );
}
