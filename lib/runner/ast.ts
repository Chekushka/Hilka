/**
 * Skulpt's parse tree → the engine-neutral `PyAstNode` (types.ts).
 *
 * Skulpt's AST is Python 3.7-shaped; CPython's current `ast` is what the
 * neutral shape follows, so three things are normalized here and nowhere
 * else:
 * - `Num`, `Str`, `Bytes`, `NameConstant` → `Constant { value }`.
 * - `Index` (a subscript wrapper CPython 3.9 removed) → its value;
 *   `ExtSlice` → a `Tuple` of its dimensions.
 * - `FormattedValue.conversion` → CPython's int (`-1`, or the flag's char
 *   code: 114 for `!r`).
 *
 * Skulpt also reports line 1 for every expression inside an f-string, not the
 * f-string's own line (AI_CONTEXT.md, Gotchas), so those inherit the line of
 * the enclosing `JoinedStr`.
 */
import { describeError } from './describe-error';
import type { SkulptAstNode, SkulptGlobal, SkulptPyObject } from './skulpt.d';
import type { ParseResult, PyAstNode, PyAstValue } from './types';

const CONSTANT_FIELD: Record<string, string> = { Num: 'n', Str: 's', Bytes: 's', NameConstant: 'value' };

/** Skulpt-only bookkeeping with no CPython counterpart. */
const DROPPED_FIELDS = new Set(['docstring']);

function isAstNode(value: unknown): value is SkulptAstNode {
  return typeof value === 'object' && value !== null && typeof (value as SkulptAstNode)._astname === 'string';
}

/** Contexts carry no name of their own — only identity with `Sk.astnodes.Load` etc. */
const CONTEXTS = ['Load', 'Store', 'Del', 'AugLoad', 'AugStore', 'Param'];

/**
 * Operators and contexts are functions, not node objects: an operator is
 * the `Sk.astnodes.Add` constructor itself (its name on the prototype, or on
 * the function when tagged `_isenum`); a context is recognized by identity.
 */
function enumName(Sk: SkulptGlobal, value: unknown): string | null {
  if (typeof value !== 'function') return null;
  const fn = value as unknown as { _astname?: unknown; prototype?: { _astname?: unknown } };
  if (typeof fn._astname === 'string') return fn._astname;
  if (typeof fn.prototype?._astname === 'string') return fn.prototype._astname;
  return CONTEXTS.find((name) => Sk.astnodes[name] === value) ?? null;
}

function isPyObject(value: unknown): value is SkulptPyObject {
  return typeof value === 'object' && value !== null && typeof (value as SkulptPyObject)['tp$name'] === 'string';
}

function fieldsOf(node: SkulptAstNode): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (let i = 0; i < node._fields.length; i += 2) {
    const name = node._fields[i];
    const getter = node._fields[i + 1];
    if (typeof name !== 'string' || typeof getter !== 'function') continue;
    if (DROPPED_FIELDS.has(name)) continue;
    out.push([name, getter(node)]);
  }
  return out;
}

export function skulptToAst(Sk: SkulptGlobal, source: string): ParseResult {
  function value(raw: unknown, lineOverride: number | null): PyAstValue {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
    if (Array.isArray(raw)) return raw.map((item) => value(item, lineOverride));
    const op = enumName(Sk, raw);
    if (op !== null) return { type: op, line: null, fields: {} };
    if (isAstNode(raw)) return convert(raw, lineOverride);
    if (isPyObject(raw)) {
      const js = Sk.ffi.remapToJs(raw);
      if (js === null || js === undefined) return null;
      if (typeof js === 'string' || typeof js === 'number' || typeof js === 'boolean') return js;
      // A big int remaps to something else; its digits are what matters.
      return String(js);
    }
    return null;
  }

  function convert(node: SkulptAstNode, lineOverride: number | null): PyAstNode {
    const line = lineOverride ?? (typeof node.lineno === 'number' ? node.lineno : null);
    const type = node._astname;

    if (type in CONSTANT_FIELD) {
      const raw = fieldsOf(node).find(([name]) => name === CONSTANT_FIELD[type]);
      return { type: 'Constant', line, fields: { value: value(raw?.[1], null) } };
    }
    if (type === 'Index') {
      const inner = fieldsOf(node).find(([name]) => name === 'value')?.[1];
      const converted = value(inner, lineOverride);
      if (converted !== null && typeof converted === 'object' && !Array.isArray(converted)) return converted;
    }
    if (type === 'ExtSlice') {
      const dims = fieldsOf(node).find(([name]) => name === 'dims')?.[1];
      return { type: 'Tuple', line, fields: { elts: value(dims, lineOverride), ctx: { type: 'Load', line: null, fields: {} } } };
    }

    // Everything inside an f-string takes the f-string's line (see above).
    const childLine = type === 'JoinedStr' ? line : lineOverride;
    const fields: { [field: string]: PyAstValue } = {};
    for (const [name, raw] of fieldsOf(node)) {
      if (type === 'FormattedValue' && name === 'conversion') {
        fields.conversion = typeof raw === 'string' && raw.length > 0 ? raw.charCodeAt(0) : -1;
        continue;
      }
      fields[name] = value(raw, childLine);
    }
    return { type, line, fields };
  }

  try {
    const parsed = Sk.parse('<stdin>', source);
    const tree = Sk.astFromParse(parsed.cst, '<stdin>', parsed.flags);
    return { ok: true, ast: convert(tree, null) };
  } catch (caught) {
    return { ok: false, error: describeError(Sk, caught) };
  }
}
