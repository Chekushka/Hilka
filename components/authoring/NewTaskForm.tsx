'use client';

/**
 * Creates a draft task — `code`, `parsons` or `quiz`, the three types the
 * rest of the app understands end to end (docs/TASKS.md). The other three
 * have no payload shape or checker support yet, so this form does not offer
 * them — adding one is a separate slice, not a form-builder problem.
 *
 * On success the browser moves to the task's own page, where `code` writes
 * and publishes a reference solution, while `parsons` and `quiz` publish
 * directly — neither executes anything to run first.
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { t } from '@/lib/i18n';
import type { Surface, TaskType } from '@/lib/task/types';
import { formatParsonsLines, parseParsonsLines } from './parsons-form-utils';
import { parseChecksJson, parseGradeTags, parseHints } from './task-form-utils';

// Mirrors the database layer's own topic-option shape rather than importing
// it — the database is off-limits to a client component, even for a type
// (CLAUDE.md rule 4).
interface TopicOption {
  slug: string;
  title: string;
  gradeTags: number[];
}

interface NewTaskFormProps {
  topics: TopicOption[];
}

const DEFAULT_PARSONS_LINES = formatParsonsLines([
  { text: 'import turtle', indent: 0 },
  { text: 'for i in range(3):', indent: 0 },
  { text: 'turtle.forward(100)', indent: 1 },
  { text: 'turtle.right(120)', indent: 1 }
]);

export function NewTaskForm({ topics }: NewTaskFormProps) {
  const router = useRouter();
  const [taskType, setTaskType] = useState<TaskType>('code');
  const [topicSlug, setTopicSlug] = useState(topics[0]?.slug ?? '');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');

  // code-only
  const [surface, setSurface] = useState<Surface>('turtle');
  const [starter, setStarter] = useState('');

  // parsons-only
  const [linesText, setLinesText] = useState(DEFAULT_PARSONS_LINES);
  const [distractorsText, setDistractorsText] = useState('');

  // quiz-only
  const [optionsText, setOptionsText] = useState('');
  const [multiple, setMultiple] = useState(false);

  const [checksText, setChecksText] = useState('[]');
  const [hintsText, setHintsText] = useState('');
  const [difficulty, setDifficulty] = useState(2);
  const [gradeTagsText, setGradeTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedLines = parseParsonsLines(linesText);
  const parsedOptions = parseHints(optionsText);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedChecks = parseChecksJson(checksText);
    if (!parsedChecks.ok) {
      setError(t('authoring.checksInvalidJson'));
      return;
    }
    if (taskType === 'parsons' && parsedLines.length === 0) {
      setError(t('authoring.parsonsLinesEmpty'));
      return;
    }
    if (taskType === 'quiz' && parsedOptions.length === 0) {
      setError(t('authoring.quizOptionsEmpty'));
      return;
    }

    setSaving(true);
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        topicSlug,
        title,
        payload:
          taskType === 'code'
            ? { type: 'code', surface, prompt, starter }
            : taskType === 'parsons'
              ? {
                  type: 'parsons',
                  prompt,
                  lines: parsedLines,
                  distractors: parseHints(distractorsText),
                  indentMode: 'given'
                }
              : { type: 'quiz', prompt, options: parsedOptions, multiple },
        checks: parsedChecks.checks,
        hints: parseHints(hintsText),
        difficulty,
        gradeTags: parseGradeTags(gradeTagsText)
      })
    });

    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setSaving(false);
      setError(
        body.error === 'slug_taken'
          ? t('authoring.slugTaken')
          : body.error === 'unknown_topic'
            ? t('authoring.unknownTopic')
            : t('authoring.createError')
      );
      return;
    }

    const { id }: { id: string } = await response.json();
    router.push(`/tasks/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="taskType">
          {t('authoring.taskTypeLabel')}
        </label>
        <select
          id="taskType"
          value={taskType}
          onChange={(event) => setTaskType(event.target.value as TaskType)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        >
          <option value="code">{t('authoring.taskTypeCode')}</option>
          <option value="parsons">{t('authoring.taskTypeParsons')}</option>
          <option value="quiz">{t('authoring.taskTypeQuiz')}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="topic">
          {t('authoring.topicLabel')}
        </label>
        <select
          id="topic"
          required
          value={topicSlug}
          onChange={(event) => setTopicSlug(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        >
          {topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.title} ({topic.gradeTags.join(', ')})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="slug">
          {t('authoring.slugLabel')}
        </label>
        <input
          id="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
        />
        <p className="text-xs text-ink-muted">{t('authoring.slugHint')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="title">
          {t('authoring.titleLabel')}
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      {taskType === 'code' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="surface">
            {t('authoring.surfaceLabel')}
          </label>
          <select
            id="surface"
            value={surface}
            onChange={(event) => setSurface(event.target.value as Surface)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          >
            <option value="turtle">{t('authoring.surfaceTurtle')}</option>
            <option value="console">{t('authoring.surfaceConsole')}</option>
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="prompt">
          {t('authoring.promptLabel')}
        </label>
        <textarea
          id="prompt"
          required
          rows={3}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      {taskType === 'code' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="starter">
            {t('authoring.starterLabel')}
          </label>
          <CodeEditor value={starter} onChange={setStarter} ariaLabel={t('authoring.starterLabel')} />
        </div>
      ) : taskType === 'parsons' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="parsonsLines">
              {t('authoring.parsonsLinesLabel')}
            </label>
            <textarea
              id="parsonsLines"
              rows={6}
              value={linesText}
              onChange={(event) => setLinesText(event.target.value)}
              spellCheck={false}
              className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
            />
            <p className="text-xs text-ink-muted">{t('authoring.parsonsLinesHint')}</p>
            <ul className="mt-1 text-xs text-ink-muted">
              {parsedLines.map((line, index) => (
                <li key={index}>
                  {index}: {' '.repeat(line.indent * 2)}
                  {line.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="distractors">
              {t('authoring.parsonsDistractorsLabel')}
            </label>
            <textarea
              id="distractors"
              rows={2}
              value={distractorsText}
              onChange={(event) => setDistractorsText(event.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="quizOptions">
              {t('authoring.quizOptionsLabel')}
            </label>
            <textarea
              id="quizOptions"
              rows={4}
              value={optionsText}
              onChange={(event) => setOptionsText(event.target.value)}
              className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
            />
            <p className="text-xs text-ink-muted">{t('authoring.quizOptionsHint')}</p>
            <ul className="mt-1 text-xs text-ink-muted">
              {parsedOptions.map((option, index) => (
                <li key={index}>
                  {index}: {option}
                </li>
              ))}
            </ul>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} />
            {t('authoring.quizMultipleLabel')}
          </label>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="checks">
          {t('authoring.checksLabel')}
        </label>
        <textarea
          id="checks"
          rows={6}
          value={checksText}
          onChange={(event) => setChecksText(event.target.value)}
          spellCheck={false}
          className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
        />
        <p className="text-xs text-ink-muted">{t('authoring.checksHint')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="hints">
          {t('authoring.hintsLabel')}
        </label>
        <textarea
          id="hints"
          rows={3}
          value={hintsText}
          onChange={(event) => setHintsText(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="difficulty">
            {t('authoring.difficultyLabel')}
          </label>
          <input
            id="difficulty"
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(event) => setDifficulty(Number(event.target.value))}
            className="w-24 rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="gradeTags">
            {t('authoring.gradeTagsLabel')}
          </label>
          <input
            id="gradeTags"
            value={gradeTagsText}
            onChange={(event) => setGradeTagsText(event.target.value)}
            className="w-40 rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
        </div>
      </div>

      {error && <p className="text-sm text-attention">{error}</p>}

      <button
        type="submit"
        disabled={saving || !topicSlug}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {saving ? t('authoring.creating') : t('authoring.create')}
      </button>
    </form>
  );
}
