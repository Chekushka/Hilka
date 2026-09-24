/**
 * Skulpt in Node, for scripts and unit tests only — never imported by app
 * code, which runs Python in the Worker (worker.ts). It exists so the
 * safe-subset evidence (scripts/safe-subset/) and the AST conversion tests
 * can exercise the same engine and the same stubs as the browser, without a
 * browser, while Skulpt itself stays inside lib/runner/ (CLAUDE.md rule 3).
 */
import { createRequire } from 'node:module';
import { skulptToAst } from './ast';
import { RANDOM_MODULE_PATH, RANDOM_MODULE_SOURCE } from './modules/random';
import { createRecorder, TURTLE_MODULE_PATH, TURTLE_MODULE_SOURCE } from './modules/turtle';
import type { SkulptException, SkulptGlobal } from './skulpt.d';
import type { ParseResult } from './types';

let loaded: SkulptGlobal | null = null;

function skulpt(): SkulptGlobal {
  if (loaded) return loaded;
  const scope = globalThis as unknown as {
    Sk?: SkulptGlobal;
    self?: unknown;
    __randomSeed__?: number;
    __turtle__?: ReturnType<typeof createRecorder>;
  };
  // The stubs reach their host state through `self`, as they do in a Worker.
  scope.self = globalThis;
  scope.__turtle__ = createRecorder();
  scope.__randomSeed__ = 1;
  const require = createRequire(import.meta.url);
  require('skulpt/dist/skulpt.min.js');
  require('skulpt/dist/skulpt-stdlib.js');
  const Sk = scope.Sk;
  if (!Sk) throw new Error('Skulpt did not load');
  Sk.builtinFiles.files[TURTLE_MODULE_PATH] = TURTLE_MODULE_SOURCE;
  Sk.builtinFiles.files[RANDOM_MODULE_PATH] = RANDOM_MODULE_SOURCE;
  Sk.configure({ __future__: Sk.python3 });
  loaded = Sk;
  return Sk;
}

export interface NodeRunResult {
  stdout: string;
  /** `Type: message`, or null when the program finished. */
  error: string | null;
}

export async function runInNode(code: string, stdin: string[] = []): Promise<NodeRunResult> {
  const Sk = skulpt();
  const queue = stdin.slice();
  let stdout = '';
  Sk.configure({
    output: (text: string) => {
      stdout += text;
    },
    read: (path: string) => {
      const file = Sk.builtinFiles.files[path];
      if (file === undefined) throw new Error(`File not found: '${path}'`);
      return file;
    },
    inputfunTakesPrompt: true,
    inputfun: (prompt?: string) => {
      // CPython writes the prompt to stdout; Skulpt does not (AI_CONTEXT.md,
      // Gotchas). Echo it so the two transcripts are comparable.
      stdout += prompt ?? '';
      const value = queue.shift();
      if (value === undefined) throw new Sk.builtin.EOFError('EOF when reading a line');
      return value;
    },
    execLimit: 5000,
    killableWhile: true,
    killableFor: true,
    __future__: Sk.python3
  });
  try {
    await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true));
    return { stdout, error: null };
  } catch (caught) {
    const e = caught as SkulptException;
    return { stdout, error: `${e.tp$name ?? 'Error'}: ${String(e)}` };
  }
}

export function parseInNode(source: string): ParseResult {
  return skulptToAst(skulpt(), source);
}
