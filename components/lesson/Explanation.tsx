/**
 * A lesson's explanation, rendered from lib/lessons/markdown.ts's tree as
 * ordinary elements — no HTML strings. Code examples are static by decision
 * (docs/TASKS.md, "Lessons"): shown in colour (lib/lessons/highlight.ts),
 * never run, so the explanation screen does not load the Python engine.
 */
import type { ReactNode } from 'react';
import { CodeView, FlipTile, NotesCodeView, TermGrid } from '@/components/lesson/TheoryBits';
import { parseMarkdown, type Block, type Inline } from '@/lib/lessons/markdown';
import { rememberLines, splitTerm } from '@/lib/lessons/theory';
import { t } from '@/lib/i18n';

/**
 * Inline code is a raised chip and **bold** a highlighter stroke: the words a
 * student must not miss stand out from the sentence around them (project
 * owner: more contrast on what matters).
 */
export function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.kind === 'text') return node.text;
    if (node.kind === 'code') {
      return (
        <code
          key={i}
          className="rounded-md border border-line bg-code-bg px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-ink shadow-[0_1px_0_var(--line)]"
        >
          {node.text}
        </code>
      );
    }
    if (node.kind === 'strong') {
      return (
        <strong key={i} className="rounded-sm bg-honey-soft px-0.5 font-bold text-ink [box-decoration-break:clone]">
          {renderInline(node.children)}
        </strong>
      );
    }
    return <em key={i}>{renderInline(node.children)}</em>;
  });
}

export interface RenderOptions {
  /** The deck's own view of a guess; without it a guess shows only its code — never the answer beside the question. */
  guess?: (block: Extract<Block, { kind: 'guess' }>) => ReactNode;
  /** Inside the deck: rules become flip tiles, under the card's own remember band. */
  inDeck?: boolean;
}

/** One block as an element. */
export function renderBlock(block: Block, i: number, options: RenderOptions = {}): ReactNode {
  switch (block.kind) {
    case 'cardBreak':
      return null;
    case 'remember':
      return options.inDeck ? <RememberTiles key={i} lines={block.lines} /> : <RememberNote key={i} lines={block.lines} />;
    case 'guess':
      if (options.guess) return <div key={i}>{options.guess(block)}</div>;
      return <CodeBlock key={i} text={block.guess.code} />;
    case 'heading': {
      const Tag = (['h2', 'h3', 'h4'] as const)[block.level - 1];
      return (
        <Tag key={i} className="mt-1 text-xl font-bold text-ink">
          {renderInline(block.children)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={i}>{renderInline(block.children)}</p>;
    case 'list': {
      const terms = block.ordered ? [] : block.items.map(splitTerm);
      if (terms.length > 0 && terms.every((term) => term !== null)) {
        return <TermGrid key={i} items={terms.filter((term) => term !== null)} render={renderInline} />;
      }
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className="flex flex-col gap-2">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                  block.ordered ? 'bg-accent text-surface' : 'bg-accent-soft text-accent'
                }`}
              >
                {block.ordered ? j + 1 : '•'}
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return block.lang.toLowerCase() === 'notes' ? <NotesCodeView key={i} text={block.text} /> : <CodeBlock key={i} text={block.text} />;
  }
}

export function CodeBlock({ text }: { text: string }) {
  return <CodeView text={text} />;
}

/** In the deck: each "`code` — meaning" rule a tile to flip, any other rule a bold line. */
function RememberTiles({ lines }: { lines: Inline[][] }) {
  const split = lines.map((line) => ({ line, term: splitTerm(line) }));
  const tiles = split.filter((entry) => entry.term !== null);
  const plain = split.filter((entry) => entry.term === null);
  return (
    <div className="flex flex-col gap-3" data-testid="remember-note">
      {tiles.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {tiles.map(({ term }, j) => (
            <FlipTile key={j} term={term!.term} meaning={term!.meaning} render={renderInline} />
          ))}
        </div>
      )}
      {plain.map(({ line }, j) => (
        <p key={j} className="flex gap-3 rounded-xl border-2 border-honey bg-surface px-4 py-3 text-lg font-semibold leading-snug">
          <span aria-hidden="true" className="text-honey">★</span>
          <span>{renderInline(line)}</span>
        </p>
      ))}
    </div>
  );
}

/** The rule to keep, everything shown at once — in the task panel, where there is no time to flip anything. */
export function RememberNote({ lines }: { lines: Inline[][] }) {
  return (
    <aside className="rounded-xl border-2 border-honey bg-honey-soft px-4 py-3 text-ink" data-testid="remember-note">
      <p className="flex items-center gap-2 text-sm font-bold text-honey-ink">
        <span aria-hidden="true">★</span>
        {t('theory.remember')}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5 text-base font-medium">
        {lines.map((line, j) => (
          <li key={j}>{renderInline(line)}</li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * The lesson's theory in the task panel: only its remember rules when it
 * has them — students read the whole explanation there instead of the task —
 * and the explanation itself when it has none.
 */
export function TheoryReminder({ markdown }: { markdown: string }) {
  const lines = rememberLines(markdown);
  return lines.length > 0 ? <RememberNote lines={lines} /> : <Explanation markdown={markdown} />;
}

export function Explanation({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed text-ink">
      {parseMarkdown(markdown).map((block, i) => renderBlock(block, i))}
    </div>
  );
}
