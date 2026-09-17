'use client';

/**
 * A draft `parsons` task: edit its fields, then publish. Unlike `code`,
 * nothing executes — `payload.lines` is already the correct order
 * (lib/task/parsons.ts) — so there is no reference solution to write or run
 * first; Publish alone posts the saved fields straight to the checker.
 */
import { useState, type FormEvent } from 'react';
import { t } from '@/lib/i18n';
import type { Check } from '@/lib/checker';
import type { ParsonsPayload } from '@/lib/task/types';
import { formatParsonsLines, parseParsonsLines } from './parsons-form-utils';
import { parseChecksJson, parseGradeTags, parseHints } from './task-form-utils';

export interface DraftParsonsTask {
  id: string;
  title: string;
  payload: ParsonsPayload;
  checks: Check[];
  hints: string[];
  difficulty: number;
  gradeTags: number[];
}

interface ParsonsDraftEditorProps {
  task: DraftParsonsTask;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type PublishState =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'success'; version: number }
  | { kind: 'checks_failed'; failures: string[] }
  | { kind: 'error'; message: string };

export function ParsonsDraftEditor({ task }: ParsonsDraftEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [prompt, setPrompt] = useState(task.payload.prompt);
  const [linesText, setLinesText] = useState(formatParsonsLines(task.payload.lines));
  const [distractorsText, setDistractorsText] = useState((task.payload.distractors ?? []).join('\n'));
  const [checksText, setChecksText] = useState(JSON.stringify(task.checks, null, 2));
  const [hintsText, setHintsText] = useState(task.hints.join('\n'));
  const [difficulty, setDifficulty] = useState(task.difficulty);
  const [gradeTagsText, setGradeTagsText] = useState(task.gradeTags.join(', '));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<PublishState>({ kind: 'idle' });

  const parsedLines = parseParsonsLines(linesText);

  async function save(): Promise<{ ok: true } | { ok: false }> {
    const parsedChecks = parseChecksJson(checksText);
    if (!parsedChecks.ok) {
      setSaveState('error');
      setSaveError(t('authoring.checksInvalidJson'));
      return { ok: false };
    }
    if (parsedLines.length === 0) {
      setSaveState('error');
      setSaveError(t('authoring.parsonsLinesEmpty'));
      return { ok: false };
    }
    setSaveState('saving');
    setSaveError(null);
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        payload: {
          type: 'parsons',
          prompt,
          lines: parsedLines,
          distractors: parseHints(distractorsText),
          indentMode: 'given'
        },
        checks: parsedChecks.checks,
        hints: parseHints(hintsText),
        difficulty,
        gradeTags: parseGradeTags(gradeTagsText)
      })
    });
    if (!response.ok) {
      setSaveState('error');
      setSaveError(t('authoring.saveError'));
      return { ok: false };
    }
    setSaveState('saved');
    return { ok: true };
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  async function handlePublish() {
    setPublishState({ kind: 'publishing' });
    const saved = await save();
    if (!saved.ok) {
      setPublishState({ kind: 'idle' });
      return;
    }
    const response = await fetch(`/api/tasks/${task.id}/publish`, { method: 'POST' });
    const body: { error?: string; failures?: string[]; version?: number } = await response
      .json()
      .catch(() => ({}));
    if (response.ok) {
      setPublishState({ kind: 'success', version: body.version ?? 1 });
      return;
    }
    if (body.error === 'reference_fails_checks') {
      setPublishState({ kind: 'checks_failed', failures: body.failures ?? [] });
    } else if (body.error === 'not_a_draft') {
      setPublishState({ kind: 'error', message: t('authoring.alreadyPublished') });
    } else if (body.error === 'publish_race') {
      setPublishState({ kind: 'error', message: t('authoring.publishRace') });
    } else {
      setPublishState({ kind: 'error', message: t('authoring.saveError') });
    }
  }

  if (publishState.kind === 'success') {
    return (
      <section className="mt-6 rounded-md border-l-4 border-growth bg-surface p-4">
        <h2 className="font-semibold text-growth">
          {t('authoring.publishSuccess', { version: publishState.version })}
        </h2>
      </section>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <form onSubmit={handleSave} className="flex flex-col gap-5">
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveState === 'saving'}
            className="self-start rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
          >
            {saveState === 'saving' ? t('authoring.saving') : t('authoring.save')}
          </button>
          {saveState === 'saved' && <span className="text-sm text-growth">{t('authoring.saved')}</span>}
          {saveState === 'error' && saveError && <span className="text-sm text-attention">{saveError}</span>}
        </div>
      </form>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishState.kind === 'publishing'}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {publishState.kind === 'publishing' ? t('authoring.publishing') : t('authoring.publish')}
        </button>

        {publishState.kind === 'checks_failed' && (
          <div className="text-sm text-attention">
            <p>{t('authoring.publishChecksFailed')}</p>
            <ul className="mt-1 list-disc pl-5">
              {publishState.failures.map((failure, index) => (
                <li key={index}>{failure}</li>
              ))}
            </ul>
          </div>
        )}
        {publishState.kind === 'error' && <p className="text-sm text-attention">{publishState.message}</p>}
      </section>
    </div>
  );
}
