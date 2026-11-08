'use client';

/**
 * The pieces a lesson's theory is drawn with (components/lesson/Explanation.tsx):
 * code in colour with line numbers, a `notes` block whose trailing comments a
 * student taps open line by line, term tiles for "`code` — meaning" lists, and
 * flip tiles for the rules to remember — the student recalls what a term means
 * before turning it over. Display only: nothing here runs code.
 */
import { useState, type ReactNode } from 'react';
import { highlightCode, splitNotes, type Token, type TokenKind } from '@/lib/lessons/highlight';
import type { Inline } from '@/lib/lessons/markdown';
import { t } from '@/lib/i18n';

const TOKEN_CLASS: Record<TokenKind, string> = {
  keyword: 'font-semibold text-syn-keyword',
  string: 'text-syn-string',
  number: 'text-syn-number',
  comment: 'italic text-syn-comment',
  builtin: 'font-semibold text-syn-call',
  call: 'text-syn-call',
  plain: ''
};

function Tokens({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((token, i) =>
        token.kind === 'plain' ? (
          token.text
        ) : (
          <span key={i} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        )
      )}
    </>
  );
}

const frame = 'overflow-hidden rounded-xl border-2 border-line bg-code-bg';
const rows = 'overflow-x-auto py-2 font-mono text-[0.95rem] leading-7 text-ink';
const gutter = 'w-10 flex-none select-none pr-3 text-right text-ink-muted/70';

/** Static code: coloured, numbered, every space kept. */
export function CodeView({ text }: { text: string }) {
  const lines = highlightCode(text);
  return (
    <div className={frame} data-testid="theory-code">
      <pre className={rows}>
        <code className="block min-w-max">
          {lines.map((tokens, i) => (
            <span key={i} className="flex whitespace-pre pr-4">
              <span aria-hidden="true" className={gutter}>
                {i + 1}
              </span>
              <span>
                <Tokens tokens={tokens} />
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

/**
 * A `notes` block: the code stays clean, and each line that had a trailing
 * comment carries a numbered honey dot. Tapping the line opens its note right
 * under it — one thing to read at a time, in the student's own order.
 */
export function NotesCodeView({ text }: { text: string }) {
  const lines = splitNotes(text);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  let mark = 0;
  const toggle = (i: number) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className={frame} data-testid="theory-notes">
      <p className="flex items-center gap-2 border-b border-line px-4 py-1.5 text-sm font-semibold text-honey-ink">
        <TapIcon />
        {t('theory.tapNotes')}
      </p>
      <div className={rows}>
        <div className="min-w-max">
          {lines.map((line, i) => {
            const number = line.note ? ++mark : 0;
            const shown = open.has(i);
            const code = (
              <>
                <span aria-hidden="true" className={gutter}>
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  <Tokens tokens={line.code} />
                </span>
              </>
            );
            if (!line.note) {
              return (
                <div key={i} className="flex pr-4">
                  {code}
                </div>
              );
            }
            return (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={shown}
                  aria-label={t('theory.noteFor', { n: i + 1 })}
                  className={`flex w-full items-center pr-3 text-left ${shown ? 'bg-honey-soft' : 'hover:bg-honey-soft/60'}`}
                >
                  {code}
                  <span className="flex-1" />
                  <span
                    aria-hidden="true"
                    className={`ml-3 flex h-6 w-6 flex-none items-center justify-center rounded-full font-sans text-xs font-bold ${
                      shown ? 'bg-honey-ink text-surface' : 'bg-honey text-on-bright'
                    }`}
                  >
                    {number}
                  </span>
                </button>
                {shown && (
                  <p className="line-in mx-3 mb-2 ml-10 rounded-lg border-l-4 border-honey bg-surface px-3 py-1.5 font-sans text-base leading-snug text-ink">
                    {line.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A list of "`code` — meaning" lines: each a tile, the term large and its meaning beside it, under it when it does not fit. */
export function TermGrid({
  items,
  render
}: {
  items: { term: Inline[]; meaning: Inline[] }[];
  render: (nodes: Inline[]) => ReactNode;
}) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2" data-testid="term-grid">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border-2 border-line border-l-accent bg-surface px-4 py-2.5 [border-left-width:6px]"
        >
          <span className="text-lg font-bold leading-snug">{render(item.term)}</span>
          <span className="text-base leading-snug">{render(item.meaning)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A rule to remember, as a tile to flip: the term first, so the student tries
 * to recall what it means, then the meaning once they tap. Turning it back is
 * allowed; nothing is counted.
 */
export function FlipTile({
  term,
  meaning,
  render
}: {
  term: Inline[];
  meaning: Inline[];
  render: (nodes: Inline[]) => ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      aria-pressed={flipped}
      data-testid="flip-tile"
      className={`flex min-h-24 flex-col items-start justify-center gap-1 rounded-xl border-2 px-4 py-3 text-left ${
        flipped ? 'border-honey bg-surface' : 'border-honey bg-honey-soft hover:brightness-105'
      }`}
    >
      <span key={flipped ? 'back' : 'front'} className={`tile-flip flex flex-col gap-1 ${flipped ? '' : 'w-full'}`}>
        <span className={`font-bold leading-snug text-ink ${flipped ? 'text-base' : 'text-xl'}`}>{render(term)}</span>
        {flipped ? (
          <span className="text-lg font-semibold leading-snug text-ink">{render(meaning)}</span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-honey-ink">
            <FlipIcon />
            {t('theory.flipHint')}
          </span>
        )}
      </span>
    </button>
  );
}

function TapIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 flex-none">
      <circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.25" />
      <circle cx="8" cy="8" r="3" fill="currentColor" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 flex-none">
      <path
        d="M3 6.5A5 5 0 0 1 12.5 5M13 9.5A5 5 0 0 1 3.5 11M12.5 2v3h-3M3.5 14v-3h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
