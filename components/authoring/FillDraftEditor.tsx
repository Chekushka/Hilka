'use client';

/**
 * A draft `fill` task: edit its fields, then write and run a reference
 * solution and publish. `payload.template` is plain text, not a
 * CodeEditor — `{{1}}` isn't valid Python, and the Python syntax
 * highlighting would just be noise on a string that is mostly gap markers.
 * Publish otherwise works exactly like `code`'s: one clean run of a
 * separately written reference must pass every check.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { TurtleCanvas } from '@/components/canvas/TurtleCanvas';
import { humanize, humanizeTimeout } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { createRunner, type PythonRunner, type RunResult } from '@/lib/runner';
import type { Check } from '@/lib/checker';
import { isFillTemplateValid } from '@/lib/task/fill';
import type { FillPayload } from '@/lib/task/types';
import { parseChecksJson, parseGradeTags, parseHints } from './task-form-utils';

export interface DraftFillTask {
  id: string;
  title: string;
  payload: FillPayload;
  checks: Check[];
  hints: string[];
  difficulty: number;
  gradeTags: number[];
}

interface FillDraftEditorProps {
  task: DraftFillTask;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type PublishState =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'success'; version: number }
  | { kind: 'run_failed' }
  | { kind: 'checks_failed'; failures: string[] }
  | { kind: 'error'; message: string };

export function FillDraftEditor({ task }: FillDraftEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [prompt, setPrompt] = useState(task.payload.prompt);
  const [template, setTemplate] = useState(task.payload.template);
  const [checksText, setChecksText] = useState(JSON.stringify(task.checks, null, 2));
  const [hintsText, setHintsText] = useState(task.hints.join('\n'));
  const [difficulty, setDifficulty] = useState(task.difficulty);
  const [gradeTagsText, setGradeTagsText] = useState(task.gradeTags.join(', '));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [referenceCode, setReferenceCode] = useState('');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const [publishState, setPublishState] = useState<PublishState>({ kind: 'idle' });

  const runnerRef = useRef<PythonRunner | null>(null);
  useEffect(() => {
    const runner = createRunner();
    runnerRef.current = runner;
    runner.warmUp().catch(() => {});
    return () => {
      runner.dispose();
      runnerRef.current = null;
    };
  }, []);

  /** Saves the form's current fields, returning them for the caller (Publish chains off this) rather than re-reading state that might race a later keystroke. */
  async function save(): Promise<{ ok: true; checks: Check[] } | { ok: false }> {
    const parsedChecks = parseChecksJson(checksText);
    if (!parsedChecks.ok) {
      setSaveState('error');
      setSaveError(t('authoring.checksInvalidJson'));
      return { ok: false };
    }
    if (!isFillTemplateValid(template)) {
      setSaveState('error');
      setSaveError(t('authoring.templateEmpty'));
      return { ok: false };
    }
    setSaveState('saving');
    setSaveError(null);
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        payload: { type: 'fill', prompt, template },
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
    return { ok: true, checks: parsedChecks.checks };
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  async function handleRunReference() {
    const runner = runnerRef.current;
    if (!runner) return;
    setRunning(true);
    setRun(null);
    setPublishState({ kind: 'idle' });
    const result = await runner.run(referenceCode, { mode: 'headless' });
    setRun(result);
    setRunning(false);
  }

  async function handlePublish() {
    if (!run) return;
    setPublishState({ kind: 'publishing' });
    const saved = await save();
    if (!saved.ok) {
      setPublishState({ kind: 'idle' });
      return;
    }
    const response = await fetch(`/api/tasks/${task.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceCode, run })
    });
    const body: { error?: string; failures?: string[]; version?: number } = await response
      .json()
      .catch(() => ({}));
    if (response.ok) {
      setPublishState({ kind: 'success', version: body.version ?? 1 });
      return;
    }
    if (body.error === 'reference_run_failed') {
      setPublishState({ kind: 'run_failed' });
    } else if (body.error === 'reference_fails_checks') {
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
        <h2 className="font-semibold text-growth">{t('authoring.publishSuccess', { version: publishState.version })}</h2>
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
          <label className="text-sm text-ink-muted" htmlFor="template">
            {t('authoring.templateLabel')}
          </label>
          <textarea
            id="template"
            rows={6}
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            spellCheck={false}
            className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
          />
          <p className="text-xs text-ink-muted">{t('authoring.templateHint')}</p>
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

      <section className="flex flex-col gap-4 border-t border-line pt-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('authoring.referenceTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('authoring.referenceNote')}</p>
        </div>

        <CodeEditor
          value={referenceCode}
          onChange={setReferenceCode}
          errorLine={run?.error?.line ?? null}
          ariaLabel={t('authoring.referenceEditorLabel')}
        />

        <button
          type="button"
          onClick={handleRunReference}
          disabled={running}
          className="self-start rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
        >
          {running ? t('authoring.runningReference') : t('authoring.runReference')}
        </button>

        {run && (
          <div className="flex flex-wrap gap-4">
            <TurtleCanvas drawing={run.drawing} label={t('workspace.yourDrawing')} />
            {run.stdout && (
              <pre className="min-w-[220px] flex-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
                {run.stdout}
              </pre>
            )}
          </div>
        )}
        {run?.error && <p className="text-sm text-attention">{humanize(run.error, referenceCode).explanation}</p>}
        {run?.timedOut && <p className="text-sm text-attention">{humanizeTimeout().explanation}</p>}

        <button
          type="button"
          onClick={handlePublish}
          disabled={!run || run.error !== null || run.timedOut || publishState.kind === 'publishing'}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {publishState.kind === 'publishing' ? t('authoring.publishing') : t('authoring.publish')}
        </button>
        {!run && <p className="text-xs text-ink-muted">{t('authoring.publishNeedsRun')}</p>}

        {publishState.kind === 'run_failed' && (
          <p className="text-sm text-attention">{t('authoring.publishRunFailed')}</p>
        )}
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
