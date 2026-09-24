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

/**
 * A node of Skulpt's own AST (Python 3.7-shaped: `Num`, `Str`, `Index`).
 * `_fields` alternates field name and getter. Operators and contexts are
 * not objects but functions carrying `_astname` and `_isenum`.
 */
export interface SkulptAstNode {
  _astname: string;
  _fields: (string | ((node: SkulptAstNode) => unknown))[];
  lineno?: number;
  [field: string]: unknown;
}

/** A Python `str` instance: its value as a JS string. */
export interface SkulptStr extends SkulptPyObject {
  v: string;
}

/**
 * A builtin method as `str.prototype` holds it. The function lives in two
 * places: `$meth` for a call through the type, `d$def.$meth` for bound methods.
 */
export interface SkulptMethodDescriptor {
  $meth: (this: SkulptStr, ...args: SkulptPyObject[]) => unknown;
  d$def: { $meth: (this: SkulptStr, ...args: SkulptPyObject[]) => unknown };
}

export interface SkulptGlobal {
  /** Unset keys fall back to Skulpt's defaults — `__future__` to Python 2, so always pass it. */
  configure(config: Partial<SkulptConfig> & { __future__: unknown }): void;
  parse(filename: string, source: string): { cst: unknown; flags: unknown };
  astFromParse(cst: unknown, filename: string, flags: unknown): SkulptAstNode;
  /** AST node constructors and context markers, keyed by CPython's name. */
  astnodes: Record<string, unknown>;
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
    str: {
      new (value: string): SkulptPyObject;
      prototype: Record<string, SkulptMethodDescriptor | undefined>;
    };
    bool: { true$: SkulptPyObject; false$: SkulptPyObject };
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
