'use client';

/**
 * Development surface for the runner. Not a product screen — the student
 * workspace replaces it in the vertical slice. It exists so the runner can be
 * driven by hand and by the integration tests before any UI exists.
 */
import { useEffect, useRef, useState } from 'react';
import { createRunner, type ParseResult, type PythonRunner, type RunResult } from '@/lib/runner';

interface TestHooks {
  run(
    code: string,
    options: { mode: 'headless'; stdin?: string[]; timeoutMs?: number; randomSeed?: number; exprs?: string[] }
  ): Promise<RunResult>;
  runInteractive(code: string, answers: string[], delayMs: number): Promise<RunResult>;
  parse(code: string): Promise<ParseResult>;
}

declare global {
  interface Window {
    __runner__?: TestHooks;
  }
}

export default function RunnerDevPage() {
  const runnerRef = useRef<PythonRunner | null>(null);
  const [code, setCode] = useState('import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)\n');
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const runner = createRunner();
    runnerRef.current = runner;
    window.__runner__ = {
      run: (source, options) => runner.run(source, options),
      parse: (source) => runner.parse(source),
      runInteractive: (source, answers, delayMs) => {
        const queue = [...answers];
        return runner.run(source, {
          mode: 'interactive',
          onInputRequest: () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(queue.shift() ?? ''), delayMs);
            })
        });
      }
    };
    return () => {
      delete window.__runner__;
      runner.dispose();
    };
  }, []);

  async function handleRun() {
    setBusy(true);
    setResult(null);
    try {
      const runner = runnerRef.current;
      if (runner) {
        setResult(await runner.run(code, { mode: 'headless' }));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 text-ink">
      <h1 className="mb-1 text-xl font-semibold">Runner</h1>
      <p className="mb-4 text-sm text-ink-muted">Development surface, not a product screen.</p>
      <textarea
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck={false}
        rows={10}
        className="w-full rounded-md border border-line bg-code-bg p-3 font-mono text-sm"
      />
      <button
        type="button"
        onClick={handleRun}
        disabled={busy}
        data-testid="run"
        className="mt-3 rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {busy ? 'Running…' : 'Run'}
      </button>
      {result && (
        <pre
          data-testid="result"
          className="mt-4 overflow-auto rounded-md border border-line bg-code-bg p-3 font-mono text-xs"
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
