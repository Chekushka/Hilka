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
import { CardBand } from '@/components/lesson/CardBand';
import { Explanation, renderBlock } from '@/components/lesson/Explanation';
import { GuessView } from '@/components/lesson/GuessView';
import { itemsLabel } from '@/components/meta/character-text';
import { itemsUnlockedBetween, levelForXp } from '@/lib/meta/character';
import { practiceXp, type XpSources } from '@/lib/meta/progress';
import { cardKind, isAnswerable, theoryCards, THEORY_XP } from '@/lib/lessons/theory';
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
