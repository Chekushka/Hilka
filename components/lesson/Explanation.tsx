/**
 * A lesson's explanation, rendered from lib/lessons/markdown.ts's tree as
 * ordinary elements — no HTML strings. Code examples are static by decision
 * (docs/TASKS.md, "Lessons"): shown in the code face, never run, so the
 * explanation screen does not load the Python engine.
 */
import type { ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from '@/lib/lessons/markdown';

function renderInline(nodes: Inline[]): ReactNode[] {
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

function renderBlock(block: Block, i: number): ReactNode {
  switch (block.kind) {
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
      return (
        <pre
          key={i}
          className="overflow-x-auto rounded-md border border-line bg-code-bg p-3 font-mono text-sm leading-relaxed text-ink"
        >
          <code>{block.text}</code>
        </pre>
      );
  }
}

export function Explanation({ markdown }: { markdown: string }) {
  return <div className="flex flex-col gap-3 leading-relaxed text-ink">{parseMarkdown(markdown).map(renderBlock)}</div>;
}
