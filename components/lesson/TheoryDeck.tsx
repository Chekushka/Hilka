'use client';

/**
 * A lesson's theory as cards (lib/lessons/theory.ts): one idea at a time,
 * Next and Back, arrow keys and a swipe on a phone. A guess card
 * is always answered before the deck moves on, and a wrong answer is never
 * held against anyone — it shows what the code prints and why, in the same
 * calm tone as a right one (project owner's decision). Going through the
 * whole deck earns THEORY_XP once per lesson, in practice only; the teacher's
 * preview (no `lessonSlug`) records nothing.
 *
 * Each card wears a band saying what it is — an idea, a question, a rule to
 * keep — in a colour of its own, so the question and the rule stand out from
 * the explanation around them (project owner: less text, more contrast, more
 * to do). The progress bar is also a way back to any card already seen.
 *
 * An explanation with no `---` and no guess is shown as it always was.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { CodeBlock, Explanation, renderBlock, renderInline } from '@/components/lesson/Explanation';
import { itemsLabel } from '@/components/meta/character-text';
import { itemsUnlockedBetween, levelForXp } from '@/lib/meta/character';
import { practiceXp, type XpSources } from '@/lib/meta/progress';
import type { Guess } from '@/lib/lessons/markdown';
import { cardKind, isAnswerable, optionOrder, theoryCards, THEORY_XP, type CardKind } from '@/lib/lessons/theory';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { hasCompletedTheory, markTheoryCompleted } from '@/lib/practice/progress';
import { t } from '@/lib/i18n';

interface TheoryDeckProps {
  markdown: string;
  /** The lesson whose theory this is; absent in the teacher's preview, which records nothing. */
  lessonSlug?: string;
  /** What XP is counted from, for the reward at the end. */
  xp?: XpSources;
  /** Under the last card once it is done: the way into the tasks. */
  finish?: ReactNode;
}

/** Where a guess sits: card, then block within it. */
const keyOf = (card: number, block: number) => `${card}:${block}`;

const SWIPE_PX = 60;

export function TheoryDeck({ markdown, lessonSlug, xp, finish }: TheoryDeckProps) {
  const cards = useMemo(() => theoryCards(markdown), [markdown]);
  const guessKeys = useMemo(
    () =>
      cards.map((card, c) =>
        card.flatMap((block, b) => (block.kind === 'guess' && isAnswerable(block.guess) ? [keyOf(c, b)] : []))
      ),
    [cards]
  );
  const asks = guessKeys.some((keys) => keys.length > 0);

  const [index, setIndex] = useState(0);
  // The furthest card reached: the progress bar can jump back to anything up to it.
  const [furthest, setFurthest] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [progress, setProgress] = useLocalProgress();
  // XP before this visit finished the deck; null when it earned nothing now.
  const [xpBefore, setXpBefore] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const answeredNow = useRef(false);
  const moved = useRef(false);
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);

  // The teacher edits the preview as they type: a shorter deck must not leave the index past its end.
  const last = Math.max(cards.length - 1, 0);
  const current = Math.min(index, last);
  const cardDone = (c: number) => (guessKeys[c] ?? []).every((key) => key in answers);
  const finished = current === last && cardDone(current);

  // The deck's end, every guess answered: recorded once per lesson, with the XP it earned shown here.
  useEffect(() => {
    if (!finished || !lessonSlug || !asks) return;
    setProgress((previous) => {
      if (hasCompletedTheory(previous, lessonSlug)) return previous;
      if (xp) setXpBefore(practiceXp(xp, previous));
      return markTheoryCompleted(previous, lessonSlug);
    });
  }, [finished, lessonSlug, asks, setProgress, xp]);

  // An answered option is disabled and drops the focus: hand it to the way on, so Enter or → continues.
  useEffect(() => {
    if (!answeredNow.current) return;
    answeredNow.current = false;
    (nextRef.current ?? doneRef.current)?.focus({ preventScroll: true });
  }, [answers]);

  // Each new card takes the focus, so a screen reader reads it and the keys keep working — not on first load.
  useEffect(() => {
    if (!moved.current) return;
    bodyRef.current?.focus({ preventScroll: true });
    bodyRef.current?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  function go(to: number) {
    if (to < 0 || to > last) return;
    if (to > current && !cardDone(current)) return;
    moved.current = true;
    setIndex(to);
    setFurthest((value) => Math.max(value, to));
  }

  if (cards.length <= 1 && !asks) {
    return <Explanation markdown={markdown} />;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') go(current + 1);
    else if (event.key === 'ArrowLeft') go(current - 1);
    else return;
    event.preventDefault();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;
    swipeFrom.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from) return;
    const dx = event.clientX - from.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(event.clientY - from.y) > Math.abs(dx)) return;
    go(dx < 0 ? current + 1 : current - 1);
  }

  const blocked = !cardDone(current);
  const xpAfter = xp ? practiceXp(xp, progress) : 0;
  const levelBefore = levelForXp(xpBefore ?? xpAfter);
  const levelAfter = levelForXp(xpAfter);

  const kind = cardKind(cards[current]);

  return (
    <section
      aria-label={t('theory.deckLabel')}
      aria-roledescription={t('theory.roleDescription')}
      data-testid="theory-deck"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="rounded-2xl border-2 border-line bg-surface [&>*:first-child]:rounded-t-2xl [&>*:last-child]:rounded-b-2xl"
    >
      <nav aria-label={t('theory.progressLabel')} className="flex items-center gap-3 px-4 pt-3">
        <ol className="flex flex-1 gap-1.5">
          {cards.map((card, c) => {
            const reachable = c <= Math.min(furthest, last) && c !== current;
            const tone =
              c === current ? 'bg-accent' : c <= furthest ? (cardKind(card) === 'guess' ? 'bg-growth' : 'bg-accent/45') : 'bg-line';
            return (
              <li key={c} className="flex-1">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => go(c)}
                  aria-label={t('theory.goToCard', { n: c + 1 })}
                  aria-current={c === current ? 'step' : undefined}
                  className="group flex h-6 w-full items-center disabled:cursor-default"
                >
                  <span className={`h-2.5 w-full rounded-full transition-colors ${tone} ${reachable ? 'group-hover:bg-accent' : ''}`} />
                </button>
              </li>
            );
          })}
        </ol>
        <span className="text-sm font-semibold tabular-nums text-ink-muted" aria-live="polite" data-testid="theory-position">
          {t('theory.cardOf', { n: current + 1, total: cards.length })}
        </span>
      </nav>

      <div ref={bodyRef} tabIndex={-1} key={current} aria-roledescription={t('theory.cardRoleDescription')} className="success-open outline-none">
        <CardBand kind={kind} />
        <div className="flex min-h-[13rem] flex-col gap-4 px-5 py-5 text-lg leading-relaxed text-ink">
          {cards[current].map((block, b) =>
            renderBlock(block, b, {
              inDeck: true,
              guess: (guessBlock) => (
                <GuessView
                  guess={guessBlock.guess}
                  chosen={answers[keyOf(current, b)] ?? null}
                  onChoose={(option) => {
                    answeredNow.current = true;
                    setAnswers((previous) => ({ ...previous, [keyOf(current, b)]: option }));
                  }}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Sticks to the bottom of the screen while the deck is in view: at 1366×768 a long card would
          otherwise push the way on below the fold. */}
      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t-2 border-line bg-shell px-4 py-3">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 py-2 text-base font-semibold text-ink hover:border-accent disabled:invisible"
        >
          <span aria-hidden="true">←</span>
          {t('theory.prev')}
        </button>
        <span className="flex-1" />
        {blocked && (
          <span className="flex items-center gap-1.5 text-base font-semibold text-accent">
            <span aria-hidden="true">↑</span>
            {t('theory.answerFirst')}
          </span>
        )}
        {current < last && (
          <button
            ref={nextRef}
            type="button"
            onClick={() => go(current + 1)}
            disabled={blocked}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-7 py-2 text-lg font-bold text-surface hover:brightness-110 disabled:opacity-40"
          >
            {t('theory.next')}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </footer>

      {finished && (
        <div
          ref={doneRef}
          tabIndex={-1}
          className="success-open flex flex-col items-start gap-3 border-t-2 border-growth bg-accent-soft px-5 py-4 outline-none"
          data-testid="theory-done"
        >
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-bold text-ink">
            <span aria-hidden="true" className="success-badge flex h-9 w-9 items-center justify-center rounded-full bg-growth text-lg text-on-bright">
              ✓
            </span>
            <span>{t('theory.done')}</span>
            {xpBefore !== null && (
              <span className="success-badge rounded-full bg-honey px-3 py-1 text-base text-on-bright" data-testid="theory-xp">
                {t('meta.xpEarned', { xp: THEORY_XP })}
              </span>
            )}
          </p>
          {xpBefore !== null && levelAfter > levelBefore && (
            <p className="text-base font-semibold text-honey-ink">
              {t('character.levelUp', { level: levelAfter })}{' '}
              {t('character.unlocked', { items: itemsLabel(itemsUnlockedBetween(levelBefore, levelAfter)) })}
            </p>
          )}
          {finish}
        </div>
      )}
    </section>
  );
}

const BAND: Record<CardKind, { className: string; label: string; icon: ReactNode }> = {
  idea: { className: 'bg-accent-soft text-accent', label: 'theory.kindIdea', icon: <BulbIcon /> },
  guess: { className: 'bg-accent text-surface', label: 'theory.guessLabel', icon: <QuestionIcon /> },
  remember: { className: 'bg-honey text-on-bright', label: 'theory.remember', icon: <StarIcon /> }
};

/** What the card is, in its own colour and icon — never the colour alone. */
function CardBand({ kind }: { kind: CardKind }) {
  const band = BAND[kind];
  return (
    <p className={`mt-3 flex items-center gap-2.5 px-5 py-2.5 text-base font-bold ${band.className}`} data-testid="card-band">
      {band.icon}
      {t(band.label)}
    </p>
  );
}

function BulbIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 flex-none">
      <path d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5v.5h5v-.5c0-.6.2-1.1.7-1.5A5.5 5.5 0 0 0 10 2.5z" fill="currentColor" />
      <path d="M7.5 16.5h5M8.5 18.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 flex-none">
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.6 7.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.4v.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 flex-none">
      <path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.6L10 14.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" fill="currentColor" />
    </svg>
  );
}

/**
 * A guess card: the code, the outputs to choose from as lettered tiles, then
 * what it really prints — line by line, as if the program were running — and
 * why. One answer, never a retry and never a red mark: the point is to have
 * guessed before seeing it.
 */
function GuessView({ guess, chosen, onChoose }: { guess: Guess; chosen: number | null; onChoose: (option: number) => void }) {
  if (!isAnswerable(guess)) return <CodeBlock text={guess.code} />;
  const answered = chosen !== null;
  const right = chosen === guess.answer;
  const letters = t('theory.optionLetters').split('');

  return (
    <div className="flex flex-col gap-4" data-testid="guess-card">
      <CodeBlock text={guess.code} />
      <p className="text-xl font-bold">{t('theory.guessQuestion')}</p>
      <div role="group" aria-label={t('theory.guessQuestion')} className="grid gap-2.5 sm:grid-cols-2">
        {optionOrder(guess).map((option, position) => {
          const isAnswer = option === guess.answer;
          const isChosen = option === chosen;
          const tone = !answered
            ? 'border-line bg-surface hover:-translate-y-0.5 hover:border-accent'
            : isAnswer
              ? 'border-growth bg-surface'
              : isChosen
                ? 'border-dashed border-ink-muted bg-shell'
                : 'border-line bg-shell opacity-50';
          const badge = !answered
            ? 'bg-accent-soft text-accent'
            : isAnswer
              ? 'success-badge bg-growth text-on-bright'
              : 'bg-shell text-ink-muted';
          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              aria-pressed={isChosen}
              onClick={() => onChoose(option)}
              className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 text-left transition-transform ${tone}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-base font-bold ${badge}`}
              >
                {answered && isAnswer ? '✓' : letters[position] ?? position + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="whitespace-pre-wrap font-mono text-lg leading-snug text-ink">{guess.options[option]}</span>
                {answered && isAnswer && <span className="sr-only">{t('theory.correctOption')}</span>}
                {answered && isChosen && !isAnswer && (
                  <span className="text-sm font-semibold text-ink-muted">{t('theory.yourOption')}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {answered && (
          <div className="flex flex-col gap-3" data-testid="guess-feedback">
            <p className={`flex items-center gap-2 text-xl font-bold ${right ? 'text-growth' : 'text-ink'}`}>
              {right && (
                <span aria-hidden="true" className="success-badge flex h-8 w-8 items-center justify-center rounded-full bg-growth text-on-bright">
                  ✓
                </span>
              )}
              {right ? t('theory.guessRight') : t('theory.guessWrong')}
            </p>
            <OutputReveal text={guess.options[guess.answer]} />
            {guess.why && (
              <p className="flex gap-3 rounded-xl border-l-4 border-accent bg-accent-soft px-4 py-3 text-lg leading-snug">
                <span aria-hidden="true" className="mt-0.5 text-accent">
                  <BulbIcon />
                </span>
                <span>{renderInline(guess.why)}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The real output, one line after another, in the same console face as the workspace's output. */
function OutputReveal({ text }: { text: string }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-growth bg-code-bg" data-testid="guess-output">
      <p className="flex items-center gap-2 border-b border-line px-4 py-1.5 text-sm font-bold text-growth">
        <span aria-hidden="true">▶</span>
        {t('theory.outputTitle')}
      </p>
      <pre className="px-4 py-2.5 font-mono text-lg leading-7 text-ink">
        {text.split('\n').map((line, i) => (
          <span key={i} className="line-in block whitespace-pre" style={{ animationDelay: `${i * 220}ms` }}>
            {line === '' ? ' ' : line}
          </span>
        ))}
      </pre>
    </div>
  );
}
