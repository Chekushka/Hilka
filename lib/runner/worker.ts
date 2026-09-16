/**
 * The only place Python executes. Never the main thread — a runaway loop must
 * not be able to freeze the editor the student is typing into.
 *
 * Skulpt is loaded with importScripts because it is a UMD bundle with no module
 * build; scripts/sync-skulpt.mjs copies it out of node_modules into public/.
 */
import { buildExprEpilogue, createExprRecorder, EXPR_MODULE_PATH, EXPR_MODULE_SOURCE } from './modules/expr-recorder';
import { RANDOM_MODULE_PATH, RANDOM_MODULE_SOURCE } from './modules/random';
import { createRecorder, TURTLE_MODULE_PATH, TURTLE_MODULE_SOURCE } from './modules/turtle';
import { extractVars } from './py-values';
import type { SkulptException, SkulptGlobal, SkulptModule, SkulptPyObject } from './skulpt.d';
import type { DoneMessage, FromWorker, ToWorker } from './protocol';
import type { PyError, PyValue } from './types';

declare const Sk: SkulptGlobal;

const scope = self as unknown as {
  importScripts: (...urls: string[]) => void;
  __turtle__: ReturnType<typeof createRecorder>;
  __randomSeed__: number;
  __exprRecorder__: ReturnType<typeof createExprRecorder>;
};

scope.importScripts('/runner/skulpt.min.js', '/runner/skulpt-stdlib.js');

let recorder = createRecorder();
scope.__turtle__ = recorder;

let exprRecorder = createExprRecorder();
scope.__exprRecorder__ = exprRecorder;

// Replacing the modules before execution is what makes the stubs the thing
// `import turtle` and `import random` resolve to.
Sk.builtinFiles.files[TURTLE_MODULE_PATH] = TURTLE_MODULE_SOURCE;
Sk.builtinFiles.files[RANDOM_MODULE_PATH] = RANDOM_MODULE_SOURCE;
Sk.builtinFiles.files[EXPR_MODULE_PATH] = EXPR_MODULE_SOURCE;

let pendingInput: ((value: string) => void) | null = null;

function post(message: FromWorker): void {
  (self as unknown as { postMessage: (m: FromWorker) => void }).postMessage(message);
}

function read(path: string): string {
  const file = Sk.builtinFiles.files[path];
  if (file === undefined) {
    throw new Error(`File not found: '${path}'`);
  }
  return file;
}

function describeError(error: unknown): PyError {
  const e = error as SkulptException;
  let message = '';
  const args = e.args?.v;
  if (args && args.length > 0) {
    const first = Sk.ffi.remapToJs(args[0] as SkulptPyObject);
    message = typeof first === 'string' ? first : String(first);
  }
  if (!message) {
    message = String(e);
  }
  const frame = e.traceback?.[0];
  return {
    type: e.tp$name ?? 'Error',
    message,
    line: frame?.lineno ?? null,
    col: frame?.colno ?? null
  };
}

function isTimeout(error: unknown): boolean {
  return (error as SkulptException)?.tp$name === 'TimeLimitError';
}

async function handleRun(request: Extract<ToWorker, { type: 'run' }>): Promise<void> {
  recorder = createRecorder();
  scope.__turtle__ = recorder;

  exprRecorder = createExprRecorder();
  scope.__exprRecorder__ = exprRecorder;

  const code = request.code + buildExprEpilogue(request.exprs);
  const queue = request.stdin.slice();
  let inputsConsumed = 0;
  let stdout = '';
  let inputWaitMs = 0;

  Sk.configure({
    output(text: string) {
      stdout += text;
      post({ type: 'stdout', id: request.id, chunk: text });
    },
    read,
    inputfunTakesPrompt: true,
    inputfun(prompt?: string) {
      if (request.mode === 'headless') {
        if (queue.length === 0) {
          throw new Sk.builtin.EOFError('EOF when reading a line');
        }
        inputsConsumed += 1;
        return queue.shift() as string;
      }
      const started = Date.now();
      post({ type: 'input-request', id: request.id, prompt: prompt ?? '' });
      return new Promise<string>((resolve) => {
        pendingInput = (value: string) => {
          const waited = Date.now() - started;
          inputWaitMs += waited;
          // The limit is wall-clock, so a slow typist would otherwise be charged
          // for thinking time and told their program stopped responding. That is
          // the worst false positive this product can produce.
          Sk.execStart = new Date(Number(Sk.execStart) + waited);
          inputsConsumed += 1;
          pendingInput = null;
          resolve(value);
        };
      });
    },
    execLimit: request.timeoutMs,
    killableWhile: true,
    killableFor: true,
    __future__: Sk.python3
  });

  // The replaced random module reads its seed from here when it is imported.
  // Headless runs are reproducible; interactive runs are genuinely random,
  // because a dice game that always rolls the same number teaches the wrong
  // thing.
  scope.__randomSeed__ =
    request.randomSeed ?? Math.floor(Math.random() * 0xffffffff);

  const started = Date.now();
  let error: PyError | null = null;
  let timedOut = false;
  let vars: Record<string, PyValue> = {};
  try {
    const finished = await Sk.misceval.asyncToPromise(() =>
      Sk.importMainWithBody('<stdin>', false, code, true)
    );
    // Only reachable once the program — the epilogue included — ran to
    // completion, so a raised exception never leaves stale vars behind.
    vars = extractVars(finished as SkulptModule);
  } catch (caught) {
    timedOut = isTimeout(caught);
    error = describeError(caught);
  }

  const exprResults: Record<string, boolean> = {};
  request.exprs.forEach((expr, index) => {
    if (index in exprRecorder.results) {
      exprResults[expr] = exprRecorder.results[index];
    }
  });

  const done: DoneMessage = {
    type: 'done',
    id: request.id,
    stdout,
    error,
    drawing: recorder.segments,
    dots: recorder.dots,
    timedOut,
    inputsConsumed,
    elapsedMs: Date.now() - started - inputWaitMs,
    vars,
    exprResults
  };
  post(done);
}

self.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  if (message.type === 'run') {
    void handleRun(message);
  } else if (message.type === 'input' && pendingInput) {
    pendingInput(message.value);
  }
};

post({ type: 'ready' });
