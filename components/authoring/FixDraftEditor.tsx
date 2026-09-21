'use client';

/**
 * A draft `fix` task: edit its fields (including `payload.broken`, what the
 * student will see), then run a reference AND `broken` in the browser and
 * publish. Like DraftTaskEditor, Publish always saves first, in sequence —
 * but this needs two clean runs, not one: `reference.code` must pass every
 * check, and `broken` must fail at least one (TASK_SCHEMA.md, "Reference
 * solutions" — a broken program that already passes is a bug in the task).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { TurtleCanvas } from '@/components/canvas/TurtleCanvas';
import { humanize, humanizeTimeout } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { createRunner, type PythonRunner, type RunResult } from '@/lib/runner';
import type { Check } from '@/lib/checker';
import type { FixPayload, RunCase, Surface } from '@/lib/task/types';
import { parseCasesJson, parseChecksJson, parseGradeTags, parseHints } from './task-form-utils';

export interface DraftFixTask {
  id: string;
  title: string;
  payload: FixPayload;
  checks: Check[];
  cases?: RunCase[];
  hints: string[];
  difficulty: number;
  gradeTags: number[];
}

interface FixDraftEditorProps {
  task: DraftFixTask;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type PublishState =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'success'; version: number }
  | { kind: 'run_failed' }
  | { kind: 'checks_failed'; failures: string[] }
  | { kind: 'broken_passes' }
  | { kind: 'error'; message: string };

export function FixDraftEditor({ task }: FixDraftEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [surface, setSurface] = useState<Surface>(task.payload.surface);
  const [prompt, setPrompt] = useState(task.payload.prompt);
  const [broken, setBroken] = useState(task.payload.broken);
  const [checksText, setChecksText] = useState(JSON.stringify(task.checks, null, 2));
  const [casesText, setCasesText] = useState(JSON.stringify(task.cases ?? [], null, 2));
  const [hintsText, setHintsText] = useState(task.hints.join('\n'));
  const [difficulty, setDifficulty] = useState(task.difficulty);
  const [gradeTagsText, setGradeTagsText] = useState(task.gradeTags.join(', '));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [referenceCode, setReferenceCode] = useState('');
  const [running, setRunning] = useState(false);
  // One run per case (docs/TASK_SCHEMA.md, "Run cases"); a task with no
  // cases is a single-element array with no stdin, so `run` (case 0) and the
  // rest of this component's single-result assumptions still hold.
  const [caseResults, setCaseResults] = useState<RunResult[] | null>(null);
  const [casesRun, setCasesRun] = useState<RunCase[]>([]);
  const [casesError, setCasesError] = useState<string | null>(null);
  const run = caseResults?.[0] ?? null;

  const [runningBroken, setRunningBroken] = useState(false);
  const [brokenRun, setBrokenRun] = useState<RunResult | null>(null);

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
  async function save(): Promise<{ ok: true; checks: Check[]; cases: RunCase[] } | { ok: false }> {
    const parsedChecks = parseChecksJson(checksText);
    if (!parsedChecks.ok) {
      setSaveState('error');
      setSaveError(t('authoring.checksInvalidJson'));
      return { ok: false };
    }
    const parsedCases = parseCasesJson(casesText);
    if (!parsedCases.ok) {
      setSaveState('error');
      setSaveError(t('authoring.casesInvalidJson'));
      return { ok: false };
    }
    if (broken.trim().length === 0) {
      setSaveState('error');
      setSaveError(t('authoring.brokenCodeEmpty'));
      return { ok: false };
    }
    setSaveState('saving');
    setSaveError(null);
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        payload: { type: 'fix', surface, prompt, broken },
        checks: parsedChecks.checks,
        cases: parsedCases.cases,
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
    return { ok: true, checks: parsedChecks.checks, cases: parsedCases.cases };
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  async function handleRunReference() {
    const runner = runnerRef.current;
    if (!runner) return;
    const parsedCases = parseCasesJson(casesText);
    if (!parsedCases.ok) {
      setCasesError(t('authoring.casesInvalidJson'));
      return;
    }
    setCasesError(null);
    const cases = parsedCases.cases.length > 0 ? parsedCases.cases : [{ stdin: [] as string[] }];
    setRunning(true);
    setCaseResults(null);
    setCasesRun(cases);
    setPublishState({ kind: 'idle' });
    const results: RunResult[] = [];
    for (const runCase of cases) {
      results.push(await runner.run(referenceCode, { mode: 'headless', stdin: runCase.stdin }));
    }
    setCaseResults(results);
    setRunning(false);
  }

  const casesFailed = caseResults?.some((result) => result.error !== null || result.timedOut) ?? false;

  async function handleRunBroken() {
    const runner = runnerRef.current;
    if (!runner) return;
    setRunningBroken(true);
    setBrokenRun(null);
    setPublishState({ kind: 'idle' });
    const result = await runner.run(broken, { mode: 'headless' });
    setBrokenRun(result);
    setRunningBroken(false);
  }

  async function handlePublish() {
    if (!run || !caseResults || casesFailed || !brokenRun) return;
    setPublishState({ kind: 'publishing' });
    const saved = await save();
    if (!saved.ok) {
      setPublishState({ kind: 'idle' });
      return;
    }
    const response = await fetch(`/api/tasks/${task.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceCode,
        run,
        brokenRun,
        ...(saved.cases.length > 0 ? { caseRuns: caseResults } : {})
      })
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
    } else if (body.error === 'broken_passes_checks') {
      setPublishState({ kind: 'broken_passes' });
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
          <label className="text-sm text-ink-muted" htmlFor="broken">
            {t('authoring.brokenCodeLabel')}
          </label>
          <CodeEditor value={broken} onChange={setBroken} ariaLabel={t('authoring.brokenCodeLabel')} />
          <p className="text-xs text-ink-muted">{t('authoring.brokenCodeHint')}</p>
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
          <label className="text-sm text-ink-muted" htmlFor="cases">
            {t('authoring.casesLabel')}
          </label>
          <textarea
            id="cases"
            rows={4}
            value={casesText}
            onChange={(event) => setCasesText(event.target.value)}
            spellCheck={false}
            className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
          />
          <p className="text-xs text-ink-muted">{t('authoring.casesHint')}</p>
          {casesError && <p className="text-xs text-attention">{casesError}</p>}
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
          errorLine={caseResults?.find((result) => result.error)?.error?.line ?? null}
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

        {caseResults?.map((result, index) => (
          <div key={index} className="flex flex-col gap-2">
            {caseResults.length > 1 && (
              <p className="text-xs uppercase tracking-wide text-ink-muted">
                {casesRun[index]?.label ?? t('workspace.caseLabel', { n: index + 1 })}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {surface === 'turtle' && <TurtleCanvas drawing={result.drawing} label={t('workspace.yourDrawing')} />}
              {surface === 'console' && (
                <pre className="min-w-[220px] flex-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
                  {result.stdout || t('workspace.outputEmpty')}
                </pre>
              )}
            </div>
            {result.error && (
              <p className="text-sm text-attention">{humanize(result.error, referenceCode).explanation}</p>
            )}
            {result.timedOut && <p className="text-sm text-attention">{humanizeTimeout().explanation}</p>}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('authoring.brokenRunTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('authoring.brokenRunNote')}</p>
        </div>

        <button
          type="button"
          onClick={handleRunBroken}
          disabled={runningBroken}
          className="self-start rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
        >
          {runningBroken ? t('authoring.runningReference') : t('authoring.runBroken')}
        </button>

        {brokenRun && (
          <div className="flex flex-wrap gap-4">
            {surface === 'turtle' && <TurtleCanvas drawing={brokenRun.drawing} label={t('workspace.yourDrawing')} />}
            {surface === 'console' && (
              <pre className="min-w-[220px] flex-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
                {brokenRun.stdout || t('workspace.outputEmpty')}
              </pre>
            )}
          </div>
        )}
        {brokenRun?.error && (
          <p className="text-sm text-ink-muted">{humanize(brokenRun.error, broken).explanation}</p>
        )}
        {brokenRun?.timedOut && <p className="text-sm text-ink-muted">{humanizeTimeout().explanation}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={handlePublish}
          disabled={!caseResults || casesFailed || !brokenRun || publishState.kind === 'publishing'}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {publishState.kind === 'publishing' ? t('authoring.publishing') : t('authoring.publish')}
        </button>
        {(!caseResults || !brokenRun) && <p className="text-xs text-ink-muted">{t('authoring.publishNeedsBothRuns')}</p>}

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
        {publishState.kind === 'broken_passes' && (
          <p className="text-sm text-attention">{t('authoring.publishBrokenPasses')}</p>
        )}
        {publishState.kind === 'error' && <p className="text-sm text-attention">{publishState.message}</p>}
      </section>
    </div>
  );
}
