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
 * An explanation with no `---` and no guess is shown as it always was.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { CodeBlock, Explanation, renderBlock, renderInline } from '@/components/lesson/Explanation';
import { itemsLabel } from '@/components/meta/character-text';
import { itemsUnlockedBetween, levelForXp } from '@/lib/meta/character';
import { practiceXp, type XpSources } from '@/lib/meta/progress';
import type { Guess } from '@/lib/lessons/markdown';
import { isAnswerable, optionOrder, theoryCards, THEORY_XP } from '@/lib/lessons/theory';
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

  return (
    <section
      aria-label={t('theory.deckLabel')}
      aria-roledescription={t('theory.roleDescription')}
      data-testid="theory-deck"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="overflow-hidden rounded-2xl border-2 border-line bg-surface"
    >
      <header className="flex items-center gap-3 border-b border-line bg-shell px-4 py-2.5">
        <span className="text-sm font-bold text-ink">{t('theory.title')}</span>
        <span className="flex-1" />
        <span className="text-sm text-ink-muted" aria-live="polite" data-testid="theory-position">
          {t('theory.cardOf', { n: current + 1, total: cards.length })}
        </span>
        <span aria-hidden="true" className="flex gap-1.5">
          {cards.map((_, c) => (
            <span
              key={c}
              className={`h-2 rounded-full transition-all ${c === current ? 'w-5 bg-accent' : c < current ? 'w-2 bg-accent/50' : 'w-2 bg-line'}`}
            />
          ))}
        </span>
      </header>

      <div
        ref={bodyRef}
        tabIndex={-1}
        key={current}
        aria-roledescription={t('theory.cardRoleDescription')}
        className="success-open flex min-h-[14rem] flex-col gap-3 px-5 py-5 text-base leading-relaxed text-ink outline-none"
      >
        {cards[current].map((block, b) =>
          renderBlock(block, b, (guessBlock) => (
            <GuessView
              guess={guessBlock.guess}
              chosen={answers[keyOf(current, b)] ?? null}
              onChoose={(option) => {
                answeredNow.current = true;
                setAnswers((previous) => ({ ...previous, [keyOf(current, b)]: option }));
              }}
            />
          ))
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-shell px-4 py-2 text-sm font-semibold text-ink hover:border-accent disabled:invisible"
        >
          <span aria-hidden="true">←</span>
          {t('theory.prev')}
        </button>
        <span className="flex-1" />
        {blocked && <span className="text-sm text-ink-muted">{t('theory.answerFirst')}</span>}
        {current < last && (
          <button
            ref={nextRef}
            type="button"
            onClick={() => go(current + 1)}
            disabled={blocked}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-6 py-2 text-base font-bold text-surface hover:brightness-110 disabled:opacity-50"
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
          className="flex flex-col items-start gap-3 border-t border-line bg-accent-soft px-5 py-4 outline-none"
          data-testid="theory-done"
        >
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold text-ink">
            <span>{t('theory.done')}</span>
            {xpBefore !== null && (
              <span className="rounded-full bg-honey px-3 py-0.5 text-sm text-on-bright" data-testid="theory-xp">
                {t('meta.xpEarned', { xp: THEORY_XP })}
              </span>
            )}
          </p>
          {xpBefore !== null && levelAfter > levelBefore && (
            <p className="text-sm font-semibold text-honey-ink">
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

/**
 * A guess card: the code, the outputs to choose from, then what it really
 * prints and why. One answer, never a retry and never a red mark — the point
 * is to have guessed before seeing it.
 */
function GuessView({ guess, chosen, onChoose }: { guess: Guess; chosen: number | null; onChoose: (option: number) => void }) {
  if (!isAnswerable(guess)) return <CodeBlock text={guess.code} />;
  const answered = chosen !== null;
  const right = chosen === guess.answer;

  return (
    <div className="flex flex-col gap-3" data-testid="guess-card">
      <p className="self-start rounded-full bg-accent px-3 py-1 text-sm font-bold text-surface">{t('theory.guessLabel')}</p>
      <CodeBlock text={guess.code} />
      <p className="font-semibold">{t('theory.guessQuestion')}</p>
      <div role="group" aria-label={t('theory.guessQuestion')} className="grid gap-2 sm:grid-cols-2">
        {optionOrder(guess).map((option) => {
          const isAnswer = option === guess.answer;
          const isChosen = option === chosen;
          const tone = !answered
            ? 'border-line bg-surface hover:border-accent'
            : isAnswer
              ? 'border-growth bg-surface'
              : isChosen
                ? 'border-dashed border-ink-muted bg-shell'
                : 'border-line bg-shell opacity-60';
          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              aria-pressed={isChosen}
              onClick={() => onChoose(option)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left ${tone}`}
            >
              <span className="whitespace-pre-wrap font-mono text-base text-ink">{guess.options[option]}</span>
              {answered && isAnswer && (
                <span className="text-xs font-bold text-growth">✓ {t('theory.correctOption')}</span>
              )}
              {answered && isChosen && !isAnswer && (
                <span className="text-xs font-semibold text-ink-muted">{t('theory.yourOption')}</span>
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {answered && (
          <div className="flex flex-col gap-1 rounded-xl bg-shell px-4 py-3" data-testid="guess-feedback">
            <p className={`font-bold ${right ? 'text-growth' : 'text-ink'}`}>
              {right ? t('theory.guessRight') : t('theory.guessWrong')}
            </p>
            {guess.why && <p>{renderInline(guess.why)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
