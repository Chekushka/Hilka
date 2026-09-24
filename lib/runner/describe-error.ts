/** Skulpt's exception object → the engine-neutral `PyError`. */
import type { SkulptException, SkulptGlobal, SkulptPyObject } from './skulpt.d';
import type { PyError } from './types';

export function describeError(Sk: SkulptGlobal, error: unknown): PyError {
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
