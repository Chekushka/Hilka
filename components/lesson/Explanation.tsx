/**
 * A lesson's explanation, rendered from lib/lessons/markdown.ts's tree as
 * ordinary elements — no HTML strings. Code examples are static by decision
 * (docs/TASKS.md, "Lessons"): shown in the code face, never run, so the
 * explanation screen does not load the Python engine.
 */
import type { ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from '@/lib/lessons/markdown';
import { rememberLines } from '@/lib/lessons/theory';
import { t } from '@/lib/i18n';

export function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.kind === 'text') return node.text;
    if (node.kind === 'code') {
      return (
        <code key={i} className="rounded-sm bg-code-bg px-1 font-mono text-[0.9em] text-ink">
          {node.text}
        </code>
      );
    }
    if (node.kind === 'strong') return <strong key={i}>{renderInline(node.children)}</strong>;
    return <em key={i}>{renderInline(node.children)}</em>;
  });
}

/**
 * One block as an element. A guess block is interactive only in the deck
 * (TheoryDeck), which hands its own view in as `guess`; anywhere else it is
 * just its code — the answer is never printed beside the question.
 */
export function renderBlock(block: Block, i: number, guess?: (block: Extract<Block, { kind: 'guess' }>) => ReactNode): ReactNode {
  switch (block.kind) {
    case 'cardBreak':
      return null;
    case 'remember':
      return <RememberNote key={i} lines={block.lines} />;
    case 'guess':
      if (guess) return <div key={i}>{guess(block)}</div>;
      return <CodeBlock key={i} text={block.guess.code} />;
    case 'heading': {
      const Tag = (['h2', 'h3', 'h4'] as const)[block.level - 1];
      return (
        <Tag key={i} className="mt-2 font-semibold text-ink">
          {renderInline(block.children)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={i}>{renderInline(block.children)}</p>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className={`${block.ordered ? 'list-decimal' : 'list-disc'} flex flex-col gap-1 pl-6`}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return <CodeBlock key={i} text={block.text} />;
  }
}

export function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-line bg-code-bg p-3 font-mono text-sm leading-relaxed text-ink">
      <code>{text}</code>
    </pre>
  );
}

/** The rule to keep: honey, like the hint, so it reads as the thing to take away. */
export function RememberNote({ lines }: { lines: Inline[][] }) {
  return (
    <aside className="rounded-xl border-2 border-honey bg-honey-soft px-4 py-3 text-ink" data-testid="remember-note">
      <p className="flex items-center gap-2 text-sm font-bold text-honey-ink">
        <span aria-hidden="true">★</span>
        {t('theory.remember')}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 text-base font-medium">
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
  return <div className="flex flex-col gap-3 leading-relaxed text-ink">{parseMarkdown(markdown).map((block, i) => renderBlock(block, i))}</div>;
}
