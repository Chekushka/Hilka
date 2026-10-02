/**
 * "Constructs not taught yet" (docs/HOMEWORK.md, section 5, threats 2–3): a
 * chatbot or an older sibling writes `def`, `sum(...)`, a list comprehension
 * or `f"{x:.2f}"` where the lessons so far only showed a loop and `print`.
 *
 * What counts as taught is read from the content itself, not from a list kept
 * by hand: every construct some published task up to this point of the
 * curriculum uses — in its reference solution, starter, broken program,
 * template or shown code (`taughtConstructs`). A construct a student used that
 * none of those use is a fact for the teacher, not proof: some students read
 * ahead.
 *
 * Pure.
 */
import { tokenize, type Token } from './python-tokens';

const KEYWORDS = new Set([
  'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield'
]);

/** Modules whose functions are the curriculum's, so `turtle.forward(…)` is never reported as a method. */
const MODULES = new Set(['turtle', 'random', 'math', 'time', 'robot']);

const text = (token: Token | undefined) => (token && token.kind !== 'newline' ? token.text : null);

/** Whether the line holding `tokens[index]` begins with the name `first`. */
function lineStartsWith(tokens: Token[], index: number, first: string): boolean {
  let start = index;
  while (start > 0 && tokens[start - 1].kind !== 'newline') start -= 1;
  return text(tokens[start]) === first;
}

/**
 * Every construct in a program, as stable ids: `kw:def`, `call:sum`,
 * `method:append`, `import:os`, `comprehension`, `fstring`, `fstring-format`,
 * `while-true`.
 */
export function constructsIn(code: string): Set<string> {
  const tokens = tokenize(code);
  const found = new Set<string>();
  const brackets: string[] = [];

  tokens.forEach((token, index) => {
    if (token.kind === 'op') {
      if ('([{'.includes(token.text)) brackets.push(token.text);
      if (')]}'.includes(token.text)) brackets.pop();
      return;
    }
    if (token.kind === 'string') {
      if (token.fstring) {
        found.add('fstring');
        // A format spec: a colon inside braces, e.g. {x:.2f} or {n:>5}.
        if (/\{[^{}:]+:[^{}]+\}/.test(token.text)) found.add('fstring-format');
      }
      return;
    }
    if (token.kind !== 'name') return;

    const name = token.text;
    const previous = text(tokens[index - 1]);
    const next = text(tokens[index + 1]);

    if (KEYWORDS.has(name)) {
      // `for` inside brackets is a comprehension, not a loop.
      if (name === 'for' && brackets.length > 0) found.add('comprehension');
      else found.add(`kw:${name}`);
      if (name === 'while' && next === 'True') found.add('while-true');
      // `import os` and `from os import path` both name the module right after the keyword;
      // the `import` of a `from` line names what is taken from it, not a module.
      const fromLine = name === 'import' && lineStartsWith(tokens, index, 'from');
      if ((name === 'import' && !fromLine) || (name === 'from' && previous !== 'yield')) {
        const moduleName = text(tokens[index + 1]);
        if (moduleName) found.add(`import:${moduleName}`);
      }
      return;
    }
    if (next !== '(') return;
    if (previous === '.') {
      const owner = text(tokens[index - 2]);
      if (owner === null || !MODULES.has(owner)) found.add(`method:${name}`);
      return;
    }
    found.add(`call:${name}`);
  });

  // A name defined by the program itself is not a construct it borrowed.
  tokens.forEach((token, index) => {
    if (token.kind === 'name' && text(tokens[index - 1]) === 'def') found.delete(`call:${token.text}`);
  });
  return found;
}

/** Everything the given content programs use — the "taught so far" set. */
export function taughtConstructs(programs: readonly string[]): Set<string> {
  const taught = new Set<string>();
  for (const program of programs) for (const construct of constructsIn(program)) taught.add(construct);
  return taught;
}

/** The constructs in `code` that nothing taught so far uses, as the labels a teacher reads. Sorted. */
export function untaughtConstructs(code: string, taught: ReadonlySet<string>): string[] {
  return [...constructsIn(code)]
    .filter((construct) => !taught.has(construct))
    .map(constructLabel)
    .sort();
}

/** How a construct reads to a teacher: as code, so it needs no translation. */
export function constructLabel(construct: string): string {
  const [kind, name] = construct.split(':');
  switch (kind) {
    case 'kw':
      return name;
    case 'call':
      return `${name}()`;
    case 'method':
      return `.${name}()`;
    case 'import':
      return `import ${name}`;
    case 'comprehension':
      return '[… for …]';
    case 'fstring':
      return 'f"…"';
    case 'fstring-format':
      return 'f"{x:…}"';
    case 'while-true':
      return 'while True';
    default:
      return construct;
  }
}
