/**
 * Skulpt ships no types. Rather than reach for `any` — banned in lib/runner/,
 * because this code has to survive being moved to the server — this declares
 * only the surface the worker actually uses.
 */
export interface SkulptPyObject {
  v?: unknown;
  /** Skulpt's own type name for the value: 'int', 'str', 'list', 'function', … */
  'tp$name'?: string;
  /** Present on dict instances. */
  $items?(): [SkulptPyObject, SkulptPyObject][];
}

/** What `Sk.importMainWithBody` resolves with once the program finishes. */
export interface SkulptModule {
  /** Module-level bindings, keyed by name. Populated incrementally as the program runs. */
  $d: Record<string, SkulptPyObject>;
}

export interface SkulptException {
  tp$name?: string;
  args?: { v: SkulptPyObject[] };
  traceback?: { lineno?: number; colno?: number; filename?: string }[];
  toString(): string;
}

export interface SkulptConfig {
  output: (text: string) => void;
  read: (path: string) => string;
  inputfun: (prompt?: string) => string | Promise<string>;
  inputfunTakesPrompt: boolean;
  execLimit: number;
  killableWhile: boolean;
  killableFor: boolean;
  __future__: unknown;
}

export interface SkulptGlobal {
  configure(config: SkulptConfig): void;
  importMainWithBody(name: string, dumpJS: boolean, body: string, canSuspend: boolean): unknown;
  misceval: {
    asyncToPromise(fn: () => unknown): Promise<unknown>;
    isTrue(value: SkulptPyObject): boolean;
  };
  ffi: {
    remapToJs(value: SkulptPyObject): unknown;
    remapToPy(value: unknown): SkulptPyObject;
  };
  builtin: {
    func: new (fn: (...args: SkulptPyObject[]) => unknown) => unknown;
    none: { none$: unknown };
    int_: new (value: number) => SkulptPyObject;
    float_: new (value: number) => SkulptPyObject;
    EOFError: new (message: string) => SkulptException;
    TimeLimitError: new (message: string) => SkulptException;
  };
  builtinFiles: { files: Record<string, string> };
  python3: unknown;
  execStart: Date | number;
  execLimit: number;
}
