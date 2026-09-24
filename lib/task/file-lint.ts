/**
 * Upload validation step 9 (docs/TASK_SCHEMA.md, "Safe subset" and
 * `FILE_UNSUPPORTED`): reject valid Python that Hilka's engine cannot be
 * trusted to run the way IDLE does, before any of it executes.
 *
 * Reads the engine-neutral AST (lib/runner/types.ts's `PyAstNode`), never
 * Skulpt, so it runs unchanged on a CPython `ast` dump. Pure.
 *
 * Two lists decide everything:
 * - `SAFE_SUBSET` / `TURTLE_SUBSET` — what is confirmed to behave the same.
 *   `SAFE_SUBSET` is checked against real runs by
 *   scripts/safe-subset/confirm.ts; `TURTLE_SUBSET` by SPIKE.md check 7
 *   plus CPython's own turtle.py signatures.
 * - `cpython-names.json` — what CPython itself knows. A name flagged here is
 *   always real Python; a name CPython does not know either (a typo) is left
 *   alone, to fail at runtime as the student's own error. A platform
 *   limitation must never be reported for a mistake, nor the reverse.
 */
import type { ParseResult, PyAstNode, PyAstValue } from '@/lib/runner';
import cpython from './cpython-names.json';

export type ConfirmKind = 'node' | 'builtin' | 'method' | 'module' | 'format';

export const SAFE_SUBSET = {
  node: [
    'Module', 'Expr', 'Assign', 'AugAssign', 'If', 'While', 'For', 'Break', 'Continue', 'Pass',
    'Name', 'Constant', 'Call', 'Load', 'Store', 'Del',
    'BinOp', 'UnaryOp', 'Add', 'Sub', 'Mult', 'Div', 'FloorDiv', 'Mod', 'Pow', 'USub', 'UAdd',
    'BitAnd', 'BitOr', 'BitXor', 'LShift', 'RShift', 'Invert',
    'BoolOp', 'Compare', 'And', 'Or', 'Not', 'Eq', 'NotEq', 'Lt', 'LtE', 'Gt', 'GtE', 'In', 'NotIn', 'Is', 'IsNot', 'IfExp',
    'FunctionDef', 'Return', 'arguments', 'arg', 'keyword', 'Global', 'Lambda',
    'List', 'Tuple', 'Dict', 'Set', 'Subscript', 'Slice', 'Attribute', 'Delete', 'Starred',
    'ListComp', 'DictComp', 'SetComp', 'GeneratorExp', 'comprehension',
    'Try', 'ExceptHandler', 'Raise', 'Assert',
    'Import', 'ImportFrom', 'alias',
    'JoinedStr', 'FormattedValue'
  ],
  builtin: [
    'print', 'input', 'int', 'float', 'str', 'bool', 'len', 'range', 'abs', 'round', 'max', 'min', 'sum',
    'sorted', 'reversed', 'enumerate', 'zip', 'list', 'dict', 'tuple', 'set',
    'type', 'isinstance', 'any', 'all', 'chr', 'ord', 'divmod', 'pow', 'map', 'filter',
    'Exception', 'ValueError', 'TypeError', 'ZeroDivisionError', 'IndexError', 'KeyError', 'NameError', 'AssertionError'
  ],
  method: [
    'upper', 'lower', 'capitalize', 'strip', 'lstrip', 'rstrip',
    'split', 'join', 'replace', 'find', 'index', 'count', 'startswith', 'endswith',
    'isdigit', 'isspace', 'isalpha', 'isalnum', 'isupper', 'islower', 'istitle', 'title', 'swapcase',
    'center', 'ljust', 'rjust', 'zfill', 'format',
    'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'sort', 'reverse', 'copy',
    'keys', 'values', 'items', 'get', 'update', 'setdefault'
  ],
  module: [
    'math.sqrt', 'math.pi', 'math.e', 'math.floor', 'math.ceil', 'math.pow', 'math.fabs', 'math.trunc',
    'math.hypot', 'math.factorial', 'math.gcd', 'math.radians', 'math.degrees', 'math.sin', 'math.cos',
    'math.tan', 'math.log', 'math.log10',
    'random.randint', 'random.random', 'random.choice', 'random.shuffle', 'random.uniform',
    'random.randrange', 'random.sample', 'random.seed',
    'time.sleep', 'time.time'
  ],
  format: ['fixed', 'int', 'width', 'grouping', 'percent', 'exponent']
} as const satisfies Record<ConfirmKind, readonly string[]>;

/**
 * The turtle stub's surface (lib/runner/modules/turtle.ts) that matches
 * CPython: SPIKE.md check 7's 14 functions and their aliases, `setx`/`sety`
 * (same one-argument signature in CPython's turtle.py), and calls that only
 * affect the window, not the drawing that is graded — the stub accepts and
 * ignores them. `begin_fill`/`end_fill` are here on the same grounds: IDLE
 * fills the shape, Hilka draws only its outline, and the outline is what the
 * checks compare. Call forms the stub does not implement are `TURTLE_CALLS`.
 */
export const TURTLE_SUBSET = [
  'forward', 'fd', 'backward', 'bk', 'back', 'left', 'lt', 'right', 'rt',
  'goto', 'setpos', 'setposition', 'setx', 'sety', 'setheading', 'seth', 'home',
  'penup', 'pu', 'up', 'pendown', 'pd', 'down', 'pencolor', 'color', 'pensize', 'width',
  'circle', 'dot', 'speed',
  'hideturtle', 'ht', 'showturtle', 'st', 'shape', 'begin_fill', 'end_fill',
  'done', 'mainloop', 'exitonclick', 'Turtle', 'Screen', 'setup', 'bgcolor', 'title', 'tracer', 'update'
] as const;

interface CallForm {
  min: number;
  max: number;
  keywords: readonly string[];
}

/** Argument shapes the stub implements; CPython accepts more (SPIKE.md check 7). */
const TURTLE_CALLS: Record<string, CallForm> = {
  goto: { min: 2, max: 2, keywords: [] },
  pencolor: { min: 1, max: 1, keywords: [] },
  color: { min: 1, max: 1, keywords: [] },
  pensize: { min: 1, max: 1, keywords: [] },
  circle: { min: 1, max: 2, keywords: ['extent'] },
  dot: { min: 0, max: 1, keywords: [] }
};

const TURTLE_ALIASES: Record<string, string> = { setpos: 'goto', setposition: 'goto', width: 'pensize' };

const ALLOWED_MODULES = new Set(['math', 'random', 'time', 'turtle']);

/** Confirmed format-spec shapes, one id per corpus entry that confirmed it. */
const FORMAT_PATTERNS: Record<(typeof SAFE_SUBSET.format)[number], RegExp> = {
  fixed: /^\.\d+f$/,
  int: /^d$/,
  width: /^(?:[<>^]?\d+|0\d+|\d+\.\d+f)$/,
  grouping: /^,(?:\.\d+f)?$/,
  percent: /^(?:\.\d+)?%$/,
  exponent: /^(?:\.\d+)?e$/
};

export type FindingKind = 'syntax' | 'module' | 'module_attr' | 'builtin' | 'method' | 'turtle_call' | 'format_spec';

export interface LintFinding {
  kind: FindingKind;
  /** What to show the student: Python as they wrote it (`class`, `math.prod`, `.isalpha()`). */
  name: string;
  line: number | null;
  /** Key under `file.replacement` in messages/uk.json, when there is a replacement to suggest. */
  replacement?: string;
}

/** How a node type reads in source, for the handful a student could write. */
const SYNTAX_DISPLAY: Record<string, string> = {
  ClassDef: 'class', With: 'with', AsyncFunctionDef: 'async def', AsyncFor: 'async for', AsyncWith: 'async with',
  Await: 'await', Yield: 'yield', YieldFrom: 'yield from', Nonlocal: 'nonlocal', AnnAssign: 'x: тип = …',
  MatMult: '@', NamedExpr: ':=', Match: 'match'
};

const REPLACEMENTS: Record<string, string> = {
  'syntax:with': 'withOpen',
  'syntax:class': 'classDef',
  'syntax::=': 'walrus',
  'syntax:match': 'match',
  'syntax:f"{x=}"': 'fstringDebug',
  'turtle_call:goto': 'goto',
  'turtle_call:pencolor': 'pencolor',
  'turtle_call:color': 'pencolor',
  'turtle_call:pensize': 'pensize',
  'turtle_call:circle': 'circle',
  'turtle_call:dot': 'dot',
  'format_spec:': 'formatSpec'
};

const SAFE = {
  node: new Set<string>(SAFE_SUBSET.node),
  builtin: new Set<string>(SAFE_SUBSET.builtin),
  method: new Set<string>(SAFE_SUBSET.method),
  module: new Set<string>(SAFE_SUBSET.module),
  turtle: new Set<string>(TURTLE_SUBSET)
};

const KNOWN = {
  builtins: new Set(cpython.builtins),
  methods: new Set(cpython.methods),
  modules: Object.fromEntries(
    Object.entries(cpython.modules).map(([name, attrs]) => [name, new Set(attrs)])
  ) as Record<string, Set<string>>
};

function isNode(value: PyAstValue): value is PyAstNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function children(node: PyAstNode): PyAstNode[] {
  const out: PyAstNode[] = [];
  for (const value of Object.values(node.fields)) {
    if (Array.isArray(value)) value.forEach((item) => isNode(item) && out.push(item));
    else if (isNode(value)) out.push(value);
  }
  return out;
}

function str(value: PyAstValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function nodes(value: PyAstValue | undefined): PyAstNode[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return value !== undefined && isNode(value) ? [value] : [];
}

/** Everything the lint rules and the confirmation script need from one walk. */
export interface Usage {
  nodeTypes: Map<string, number | null>;
  /** Names the program binds anywhere — never mistaken for a builtin or a star import. */
  bound: Set<string>;
  /** Local name → module it names (`import random as rnd` → rnd → random). */
  moduleAliases: Map<string, string>;
  /** Local name → `module.attr` (`from math import sqrt as s` → s → math.sqrt). */
  fromImports: Map<string, string>;
  starModules: Set<string>;
  imports: { module: string; line: number | null }[];
  loads: { name: string; line: number | null }[];
  /** `module.attr`, from `import` or `from … import`. */
  moduleAttrs: { name: string; line: number | null }[];
  /** `.attr` on anything that is not a module. */
  methods: { name: string; line: number | null }[];
  calls: { target: CallTarget; args: number; keywords: string[]; starred: boolean; line: number | null }[];
  formatSpecs: { spec: string | null; line: number | null }[];
}

type CallTarget =
  | { kind: 'name'; name: string }
  | { kind: 'attr'; attr: string; receiverModule: string | null };

export function collectUsage(ast: PyAstNode): Usage {
  const usage: Usage = {
    nodeTypes: new Map(),
    bound: new Set(),
    moduleAliases: new Map(),
    fromImports: new Map(),
    starModules: new Set(),
    imports: [],
    loads: [],
    moduleAttrs: [],
    methods: [],
    calls: [],
    formatSpecs: []
  };
  const attributes: { node: PyAstNode; receiver: PyAstNode | null }[] = [];

  const visit = (node: PyAstNode) => {
    if (!usage.nodeTypes.has(node.type)) usage.nodeTypes.set(node.type, node.line);
    const f = node.fields;
    switch (node.type) {
      case 'Name': {
        const id = str(f.id);
        const ctx = nodes(f.ctx)[0]?.type;
        if (id && ctx === 'Load') usage.loads.push({ name: id, line: node.line });
        else if (id) usage.bound.add(id);
        break;
      }
      case 'FunctionDef':
      case 'ClassDef': {
        const name = str(f.name);
        if (name) usage.bound.add(name);
        break;
      }
      case 'arg': {
        const name = str(f.arg);
        if (name) usage.bound.add(name);
        break;
      }
      case 'ExceptHandler': {
        const name = str(f.name);
        if (name) usage.bound.add(name);
        break;
      }
      case 'Global':
      case 'Nonlocal':
        (Array.isArray(f.names) ? f.names : []).forEach((n) => typeof n === 'string' && usage.bound.add(n));
        break;
      case 'Import':
        for (const alias of nodes(f.names)) {
          const full = str(alias.fields.name) ?? '';
          const top = full.split('.')[0];
          const local = str(alias.fields.asname) ?? top;
          usage.imports.push({ module: top, line: node.line });
          usage.moduleAliases.set(local, str(alias.fields.asname) ? full : top);
          usage.bound.add(local);
        }
        break;
      case 'ImportFrom': {
        const level = typeof f.level === 'number' ? f.level : 0;
        const mod = level > 0 ? '.' : (str(f.module) ?? '').split('.')[0];
        usage.imports.push({ module: mod, line: node.line });
        for (const alias of nodes(f.names)) {
          const name = str(alias.fields.name) ?? '';
          if (name === '*') {
            usage.starModules.add(mod);
            continue;
          }
          const local = str(alias.fields.asname) ?? name;
          usage.fromImports.set(local, `${mod}.${name}`);
          usage.moduleAttrs.push({ name: `${mod}.${name}`, line: node.line });
          usage.bound.add(local);
        }
        break;
      }
      case 'Attribute': {
        attributes.push({ node, receiver: nodes(f.value)[0] ?? null });
        break;
      }
      case 'FormattedValue': {
        const spec = nodes(f.format_spec)[0];
        if (spec) {
          const parts = nodes(spec.fields.values);
          const literal = parts.every((p) => p.type === 'Constant' && typeof p.fields.value === 'string');
          usage.formatSpecs.push({
            spec: literal ? parts.map((p) => String(p.fields.value)).join('') : null,
            line: node.line
          });
        }
        break;
      }
      default:
        break;
    }
    children(node).forEach(visit);
  };
  visit(ast);

  // Attributes and calls need every import binding first — an import can
  // come after the function that uses it.
  const moduleOf = (receiver: PyAstNode | null): string | null => {
    if (!receiver || receiver.type !== 'Name') return null;
    const id = str(receiver.fields.id);
    return id ? (usage.moduleAliases.get(id) ?? null) : null;
  };
  for (const { node, receiver } of attributes) {
    const attr = str(node.fields.attr) ?? '';
    const mod = moduleOf(receiver);
    if (mod) usage.moduleAttrs.push({ name: `${mod}.${attr}`, line: node.line });
    else usage.methods.push({ name: attr, line: node.line });
  }

  const visitCalls = (node: PyAstNode) => {
    if (node.type === 'Call') {
      const func = nodes(node.fields.func)[0];
      const args = nodes(node.fields.args);
      const keywords = nodes(node.fields.keywords);
      let target: CallTarget | null = null;
      if (func?.type === 'Name') {
        target = { kind: 'name', name: str(func.fields.id) ?? '' };
      } else if (func?.type === 'Attribute') {
        target = { kind: 'attr', attr: str(func.fields.attr) ?? '', receiverModule: moduleOf(nodes(func.fields.value)[0] ?? null) };
      }
      if (target) {
        usage.calls.push({
          target,
          args: args.length,
          keywords: keywords.map((k) => str(k.fields.arg) ?? '**'),
          starred: args.some((a) => a.type === 'Starred') || keywords.some((k) => k.fields.arg === null),
          line: node.line
        });
      }
    }
    children(node).forEach(visitCalls);
  };
  visitCalls(ast);

  return usage;
}

function formatSpecId(spec: string): (typeof SAFE_SUBSET.format)[number] | null {
  for (const [id, pattern] of Object.entries(FORMAT_PATTERNS) as [(typeof SAFE_SUBSET.format)[number], RegExp][]) {
    if (pattern.test(spec)) return id;
  }
  return null;
}

/** For the confirmation script: which safe-subset names a program actually exercises. */
export function exercisedNames(usage: Usage): Record<ConfirmKind, Set<string>> {
  return {
    node: new Set(usage.nodeTypes.keys()),
    builtin: new Set(usage.loads.filter((l) => !usage.bound.has(l.name)).map((l) => l.name)),
    method: new Set(usage.methods.map((m) => m.name)),
    module: new Set(usage.moduleAttrs.map((m) => m.name)),
    format: new Set(usage.formatSpecs.map((s) => (s.spec === null ? null : formatSpecId(s.spec))).filter((id): id is (typeof SAFE_SUBSET.format)[number] => id !== null))
  };
}

function lintAst(ast: PyAstNode): LintFinding[] {
  const usage = collectUsage(ast);
  const findings: LintFinding[] = [];
  const add = (kind: FindingKind, name: string, line: number | null) => {
    if (findings.some((f) => f.kind === kind && f.name === name)) return;
    const replacement = REPLACEMENTS[`${kind}:${name}`] ?? (kind === 'format_spec' ? REPLACEMENTS['format_spec:'] : undefined);
    findings.push(replacement ? { kind, name, line, replacement } : { kind, name, line });
  };
  const turtleImported = usage.imports.some((i) => i.module === 'turtle');

  // Syntax: every node type outside the confirmed set is real CPython syntax
  // (it parsed), so no typo check is needed here.
  for (const [type, line] of usage.nodeTypes) {
    if (!SAFE.node.has(type)) add('syntax', SYNTAX_DISPLAY[type] ?? type, line);
  }

  // Imports: single file only (v1), and only the modules the corpus covers.
  for (const { module: mod, line } of usage.imports) {
    if (!ALLOWED_MODULES.has(mod)) add('module', mod === '.' ? 'from . import' : mod, line);
  }

  const moduleAttrAllowed = (full: string): boolean => {
    const [mod, attr] = full.split('.');
    return mod === 'turtle' ? SAFE.turtle.has(attr) : SAFE.module.has(full);
  };
  const moduleAttrKnown = (full: string): boolean => {
    const [mod, attr] = full.split('.');
    return KNOWN.modules[mod]?.has(attr) ?? false;
  };
  for (const { name, line } of usage.moduleAttrs) {
    if (ALLOWED_MODULES.has(name.split('.')[0]) && !moduleAttrAllowed(name) && moduleAttrKnown(name)) {
      add('module_attr', name, line);
    }
  }

  for (const { name, line } of usage.loads) {
    if (usage.bound.has(name)) continue;
    if (KNOWN.builtins.has(name)) {
      if (!SAFE.builtin.has(name)) add('builtin', name, line);
      continue;
    }
    // A bare name from `from turtle import *` and friends.
    for (const mod of usage.starModules) {
      const full = `${mod}.${name}`;
      if (ALLOWED_MODULES.has(mod) && moduleAttrKnown(full) && !moduleAttrAllowed(full)) add('module_attr', full, line);
    }
  }

  for (const { name, line } of usage.methods) {
    if (SAFE.method.has(name) || (turtleImported && SAFE.turtle.has(name))) continue;
    const known = KNOWN.methods.has(name) || (turtleImported && (KNOWN.modules.turtle?.has(name) ?? false));
    if (known) add('method', `.${name}()`, line);
  }

  if (turtleImported) {
    for (const call of usage.calls) {
      if (call.starred) continue;
      let name: string | null = null;
      if (call.target.kind === 'attr') {
        const attr = call.target.attr;
        // `d.update(…)` and friends are dict methods first; only turtle's own names are checked.
        const turtleReceiver = call.target.receiverModule === 'turtle' || (call.target.receiverModule === null && !SAFE.method.has(attr));
        if (turtleReceiver) name = attr;
      } else {
        const imported = usage.fromImports.get(call.target.name);
        if (imported?.startsWith('turtle.')) name = imported.slice('turtle.'.length);
        else if (usage.starModules.has('turtle') && !usage.bound.has(call.target.name)) name = call.target.name;
      }
      if (!name) continue;
      const canonical = TURTLE_ALIASES[name] ?? name;
      const form = TURTLE_CALLS[canonical];
      if (!form) continue;
      const total = call.args + call.keywords.length;
      const badKeyword = call.keywords.some((k) => !form.keywords.includes(k));
      if (call.args > form.max || total < form.min || total > form.max || badKeyword) {
        add('turtle_call', canonical, call.line);
      }
    }
  }

  for (const { spec, line } of usage.formatSpecs) {
    if (spec === null) add('format_spec', '{…:{…}}', line);
    else if (formatSpecId(spec) === null) add('format_spec', `:${spec}`, line);
  }

  return findings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

type Segment = { code: string; line: number } | { string: string; prefix: string; line: number };

/** Splits source into code and string literals, dropping comments — just enough for `lintUnparseable`. */
function segments(source: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let line = 1;
  let code = '';
  let codeLine = 1;
  const flush = () => {
    if (code) out.push({ code, line: codeLine });
    code = '';
  };
  while (i < source.length) {
    const ch = source[i];
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const prefixMatch = /[a-zA-Z]{0,2}$/.exec(code);
      const prefix = prefixMatch ? prefixMatch[0] : '';
      code = code.slice(0, code.length - prefix.length);
      flush();
      const quote = source.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      const start = line;
      let j = i + quote.length;
      let body = '';
      while (j < source.length && !source.startsWith(quote, j)) {
        if (source[j] === '\\') {
          body += source.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (source[j] === '\n') {
          if (quote.length === 1) break;
          line += 1;
        }
        body += source[j];
        j += 1;
      }
      out.push({ string: body, prefix: prefix.toLowerCase(), line: start });
      i = j + quote.length;
      codeLine = line;
      continue;
    }
    if (ch === '\n') line += 1;
    if (!code) codeLine = line;
    code += ch;
    i += 1;
  }
  flush();
  return out;
}

function lineOf(segment: { line: number }, text: string, index: number): number {
  return segment.line + (text.slice(0, index).match(/\n/g)?.length ?? 0);
}

/**
 * Skulpt's parser rejects some valid CPython syntax outright — confirmed by
 * the corpus: `:=`, `match`, and `f"{x=}"`. With no tree to read, those are
 * recognized from the source instead. Only called when the parse failed, so
 * a false match can only turn an already-broken file's SyntaxError into
 * this message, never reject a file that runs.
 */
function lintUnparseable(source: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const segs = segments(source);
  const codeOnly = segs.map((s) => ('code' in s ? s.code : '""')).join('');
  for (const seg of segs) {
    if ('code' in seg) {
      const walrus = seg.code.indexOf(':=');
      if (walrus >= 0 && !findings.some((f) => f.name === ':=')) {
        findings.push({ kind: 'syntax', name: ':=', line: lineOf(seg, seg.code, walrus), replacement: 'walrus' });
      }
      const match = /^[ \t]*match\b[^\n]*:[ \t]*$/m.exec(seg.code);
      if (match && /^[ \t]*case\b/m.test(codeOnly) && !findings.some((f) => f.name === 'match')) {
        findings.push({ kind: 'syntax', name: 'match', line: lineOf(seg, seg.code, match.index), replacement: 'match' });
      }
    } else if (seg.prefix.includes('f') && /\{[^{}]*[^=!<>{]=\s*(?:![rsa])?\s*(?::[^{}]*)?\}/.test(seg.string)) {
      if (!findings.some((f) => f.name === 'f"{x=}"')) {
        findings.push({ kind: 'syntax', name: 'f"{x=}"', line: seg.line, replacement: 'fstringDebug' });
      }
    }
  }
  return findings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

/**
 * Step 9. Empty means the file may run. A parse that failed for any other
 * reason is the student's own SyntaxError — it runs, and `lib/errors/`
 * explains it like any other.
 */
export function lintFile(parsed: ParseResult, source: string): LintFinding[] {
  return parsed.ok ? lintAst(parsed.ast) : lintUnparseable(source);
}
