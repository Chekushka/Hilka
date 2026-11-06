/**
 * The small subset of Markdown a lesson explanation uses, parsed into a tree
 * that React renders as ordinary elements — never HTML strings, so nothing in
 * an explanation can inject markup. Supported: `#`–`###` headings,
 * paragraphs, `-`/`*` and `1.` lists, fenced code blocks, and inline
 * `code`, **bold** and *italic*. Anything else is kept as literal text.
 *
 * Code blocks are static by decision (docs/TASKS.md, "Lessons"): shown, not
 * run.
 *
 * Three additions make an explanation a deck of cards (lib/lessons/theory.ts):
 * a line of `---` starts a new card; a ```guess fence is a «Як думаєш?» card
 * (code, the outputs to choose from, why); a ```remember fence is the rule to
 * keep, shown in honey and again in the task panel.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'code'; lang: string; text: string }
  /** A line of `---`: the next card starts here. */
  | { kind: 'cardBreak' }
  | { kind: 'guess'; guess: Guess }
  /** One rule per line, inline Markdown allowed. */
  | { kind: 'remember'; lines: Inline[][] };

/**
 * What is wrong with a guess block's shape — caught before anything runs.
 * Whether the marked option is really what the code prints is a separate
 * question, answered by running it (lib/lessons/theory.ts's checkGuessRuns).
 */
export type GuessProblem = 'noCode' | 'tooFewOptions' | 'emptyOption' | 'noAnswer' | 'severalAnswers' | 'duplicateOptions' | 'readsInput';

/**
 * A «Як думаєш?» card: code, what it might print, and which of those it does.
 *
 *     ```guess
 *     x = 5
 *     x = x + 2
 *     print(x)
 *     --
 *     5
 *     -- *
 *     7
 *     -- чому
 *     `x + 2` бере старе значення.
 *     ```
 *
 * `--` starts an option, `-- *` the right one, `-- чому` the explanation
 * shown after answering. Options may span lines — a loop prints several.
 */
export interface Guess {
  code: string;
  options: string[];
  /** Index into `options`; null when no option or more than one is marked (see `problems`). */
  answer: number | null;
  why: Inline[] | null;
  problems: GuessProblem[];
}

const FENCE = /^```\s*([\w-]*)\s*$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
const CARD_BREAK = /^-{3,}$/;
/** Inside a guess fence: `--`, `-- *` or `-- чому` on a line of its own. */
const GUESS_MARKER = /^--\s*(\*|чому)?$/i;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    const fence = FENCE.exec(trimmed);
    if (fence) {
      flushParagraph();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i].trim())) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence; an unclosed fence runs to the end
      const lang = fence[1].toLowerCase();
      if (lang === 'guess') {
        blocks.push({ kind: 'guess', guess: parseGuess(body) });
      } else if (lang === 'remember') {
        const lines = body.map((line) => line.trim()).filter((line) => line !== '');
        blocks.push({ kind: 'remember', lines: lines.map(parseInline) });
      } else {
        blocks.push({ kind: 'code', lang: fence[1], text: body.join('\n') });
      }
      continue;
    }

    if (CARD_BREAK.test(trimmed)) {
      flushParagraph();
      blocks.push({ kind: 'cardBreak' });
      i++;
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      i++;
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2].trim())
      });
      i++;
      continue;
    }

    const ordered = NUMBERED.test(trimmed);
    if (ordered || BULLET.test(trimmed)) {
      flushParagraph();
      const pattern = ordered ? NUMBERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const match = pattern.exec(lines[i].trim());
        if (!match) break;
        items.push(parseInline(match[1]));
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    paragraph.push(trimmed);
    i++;
  }
  flushParagraph();
  return blocks;
}

/** Leading and trailing blank lines dropped; indentation inside kept — it is Python. */
function trimBlankLines(lines: string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines
    .slice(start, end)
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
}

export function parseGuess(body: string[]): Guess {
  const code: string[] = [];
  const options: { lines: string[]; marked: boolean }[] = [];
  const why: string[] = [];
  let section: 'code' | 'option' | 'why' = 'code';

  for (const line of body) {
    const marker = GUESS_MARKER.exec(line.trim());
    if (marker) {
      if (marker[1]?.toLowerCase() === 'чому') {
        section = 'why';
      } else {
        section = 'option';
        options.push({ lines: [], marked: marker[1] === '*' });
      }
      continue;
    }
    if (section === 'code') code.push(line);
    else if (section === 'option') options[options.length - 1].lines.push(line);
    else why.push(line.trim());
  }

  const texts = options.map((option) => trimBlankLines(option.lines));
  const marked = options.flatMap((option, index) => (option.marked ? [index] : []));
  const source = trimBlankLines(code);
  const whyText = why.filter((line) => line !== '').join(' ');

  const problems: GuessProblem[] = [];
  if (source === '') problems.push('noCode');
  if (options.length < 2) problems.push('tooFewOptions');
  if (texts.some((text) => text === '')) problems.push('emptyOption');
  if (marked.length === 0) problems.push('noAnswer');
  if (marked.length > 1) problems.push('severalAnswers');
  if (new Set(texts).size !== texts.length) problems.push('duplicateOptions');
  // Nothing on the theory screen can type an answer to input(), and the run that proves the answer has no stdin.
  if (/\binput\s*\(/.test(source)) problems.push('readsInput');

  return {
    code: source,
    options: texts,
    answer: marked.length === 1 ? marked[0] : null,
    why: whyText === '' ? null : parseInline(whyText),
    problems
  };
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) {
      out.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ kind: 'code', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: 'strong', children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '*' && text[i + 1] !== '*' && text[i + 1] !== ' ') {
      const end = text.indexOf('*', i + 1);
      if (end > i + 1 && text[end - 1] !== ' ') {
        flush();
        out.push({ kind: 'em', children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buffer += text[i];
    i++;
  }
  flush();
  return out;
}
