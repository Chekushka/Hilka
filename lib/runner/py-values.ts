/**
 * Converts a finished program's global scope into plain JS values, for
 * `var_equals`. Restricted to data Python considers simple — numbers,
 * strings, booleans, None, and lists/tuples/dicts of those, recursively —
 * because a function, a class, or an imported module is not a value a task
 * can meaningfully compare against, and leaking one out of the worker would
 * hand the checker a Skulpt internal it has no business holding.
 *
 * Only reachable after a run that completed without throwing: `module.$d` is
 * this file's whole input, and a run that raised never resolves with a
 * module to read it from.
 */
import type { PyValue } from './types';
import type { SkulptGlobal, SkulptModule, SkulptPyObject } from './skulpt.d';

declare const Sk: SkulptGlobal;

const DUNDER = /^__.*__$/;
const SIMPLE_TYPES = new Set(['bool', 'int', 'float', 'str']);
const MAX_DEPTH = 6;

/**
 * Skulpt stores a global under `<name>_$rw$` when `<name>` collides with a
 * JS reserved word or an Object/Function prototype member (`name`, `length`,
 * `constructor`, `for`, …) — see `fixReserved` in Skulpt's compiler. `$` is
 * not a legal character in a Python identifier, so the suffix can never
 * belong to the name itself and stripping it is always safe.
 */
function unmangle(name: string): string {
  return name.endsWith('_$rw$') ? name.slice(0, -'_$rw$'.length) : name;
}

function convertValue(value: SkulptPyObject, depth: number): PyValue | undefined {
  const tpName = (value as { 'tp$name'?: string })['tp$name'];
  if (tpName === 'NoneType') {
    return null;
  }
  if (tpName !== undefined && SIMPLE_TYPES.has(tpName)) {
    return Sk.ffi.remapToJs(value) as PyValue;
  }
  if (depth >= MAX_DEPTH) {
    return undefined;
  }
  if (tpName === 'list' || tpName === 'tuple') {
    const items = (value as { v: SkulptPyObject[] }).v ?? [];
    const converted: PyValue[] = [];
    for (const item of items) {
      const c = convertValue(item, depth + 1);
      if (c === undefined) return undefined;
      converted.push(c);
    }
    return converted;
  }
  if (tpName === 'dict') {
    const dict = value as unknown as { $items(): [SkulptPyObject, SkulptPyObject][] };
    const out: Record<string, PyValue> = {};
    for (const [key, val] of dict.$items()) {
      const jsKey = Sk.ffi.remapToJs(key);
      if (typeof jsKey !== 'string' && typeof jsKey !== 'number') return undefined;
      const converted = convertValue(val, depth + 1);
      if (converted === undefined) return undefined;
      out[String(jsKey)] = converted;
    }
    return out;
  }
  // A function, a class, an instance, an imported module — not exposed.
  return undefined;
}

/** Every module-level name that holds a plain value, skipping dunders. */
export function extractVars(module: SkulptModule): Record<string, PyValue> {
  const vars: Record<string, PyValue> = {};
  for (const name of Object.keys(module.$d)) {
    if (DUNDER.test(name)) continue;
    const converted = convertValue(module.$d[name], 0);
    if (converted !== undefined) {
      vars[unmangle(name)] = converted;
    }
  }
  return vars;
}
