'use client';

/**
 * A lesson's theory on the projector or an interactive whiteboard
 * (lib/lessons/present.ts): the student's cards, one to a screen and as large
 * as the window allows, led by the teacher. Nothing waits for an answer and
 * any card is a tap away. On a guess card the class votes first; then
 * a tap on the option the class chose, or one press of "forward" (an arrow, a
 * remote's button, the big button), opens what the program prints — the next
 * press moves on. Nothing is recorded: no XP, no progress.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { toggleFullscreen, FullscreenButton } from '@/components/game/FullscreenButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CardBand } from '@/components/lesson/CardBand';
import { renderBlock } from '@/components/lesson/Explanation';
import { GuessView } from '@/components/lesson/GuessView';
import { clampScale, forwardStep, presentKeyAction, rootFontSize, stepScale } from '@/lib/lessons/present';
import { cardKind, isAnswerable, theoryCards } from '@/lib/lessons/theory';
import { t } from '@/lib/i18n';

const SCALE_KEY = 'hilka.present.scale';
const SWIPE_PX = 60;

/** Where a guess sits: card, then block within it. */
const keyOf = (card: number, block: number) => `${card}:${block}`;

function readScale(): number {
  try {
    const stored = window.localStorage.getItem(SCALE_KEY);
    return stored === null ? 1 : clampScale(Number(stored));
  } catch {
    return 1;
  }
}

function saveScale(scale: number) {
  try {
    window.localStorage.setItem(SCALE_KEY, String(scale));
  } catch {
    // A private window or blocked storage: the size simply is not remembered.
  }
}

export function PresentDeck({ title, markdown }: { title: string; markdown: string }) {
  const cards = useMemo(() => theoryCards(markdown), [markdown]);
  const guessKeys = useMemo(
    () =>
      cards.map((card, c) =>
        card.flatMap((block, b) => (block.kind === 'guess' && isAnswerable(block.guess) ? [keyOf(c, b)] : []))
      ),
    [cards]
  );
  const last = Math.max(cards.length - 1, 0);

  const [current, setCurrent] = useState(0);
  // A key is here once its answer is open; the value is the option the class chose, or null.
  const [opened, setOpened] = useState<Record<string, number | null>>({});
  const [scale, setScale] = useState(() => (typeof window === 'undefined' ? 1 : readScale()));
  const mainRef = useRef<HTMLElement>(null);
  // Set when an answer has just opened: bring it into view, once, if the card is taller than the screen.
  const openedNow = useRef(false);
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);

  const hidden = (guessKeys[current] ?? []).some((key) => !(key in opened));

  // Every size on the page is in rem: the root font size scales the whole card at once.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = rootFontSize(scale);
    return () => {
      root.style.fontSize = before;
    };
  }, [scale]);

  useEffect(() => {
    if (!openedNow.current) return;
    openedNow.current = false;
    const feedback = mainRef.current?.querySelectorAll('[data-testid="guess-feedback"]');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    feedback?.[feedback.length - 1]?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [opened]);

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to > last) return;
      setCurrent(to);
      mainRef.current?.scrollTo({ top: 0 });
    },
    [last]
  );

  const forward = useCallback(() => {
    const step = forwardStep(current, last, hidden);
    if (step.kind === 'reveal') {
      openedNow.current = true;
      setOpened((previous) => {
        const next = { ...previous };
        for (const key of guessKeys[current] ?? []) if (!(key in next)) next[key] = null;
        return next;
      });
    } else if (step.kind === 'move') {
      go(step.to);
    }
  }, [current, last, hidden, guessKeys, go]);

  const resize = useCallback((direction: 1 | -1) => {
    setScale((value) => {
      const next = stepScale(value, direction);
      saveScale(next);
      return next;
    });
  }, []);

  // The whole window is the deck: keys work wherever the focus is, except where they already mean something.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // Space on a focused button presses that button.
      if (event.key === ' ' && target?.closest('button, a')) return;
      const action = presentKeyAction(event.key, event.code);
      if (!action) return;
      event.preventDefault();
      if (action === 'forward') forward();
      else if (action === 'back') go(current - 1);
      else if (action === 'first') go(0);
      else if (action === 'last') go(last);
      else if (action === 'fullscreen') toggleFullscreen();
      else resize(action === 'bigger' ? 1 : -1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [forward, go, current, last, resize]);

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
    if (dx < 0) forward();
    else go(current - 1);
  }

  const card = cards[Math.min(current, last)] ?? [];

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-bg"
      aria-label={t('present.deckLabel')}
      aria-roledescription={t('theory.roleDescription')}
      data-testid="present-deck"
    >
      <header className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-shell px-4 py-1.5 text-sm text-ink-muted">
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</span>
        <span className="max-md:hidden">{t('present.keysHint')}</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => resize(-1)}
            aria-label={t('present.smaller')}
            title={t('present.smaller')}
            className="h-9 min-w-9 rounded-md px-2 font-bold hover:bg-surface hover:text-ink"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => resize(1)}
            aria-label={t('present.bigger')}
            title={t('present.bigger')}
            className="h-9 min-w-9 rounded-md px-2 text-base font-bold hover:bg-surface hover:text-ink"
          >
            A+
          </button>
        </span>
        <ThemeToggle />
        <FullscreenButton />
      </header>

      <nav aria-label={t('theory.progressLabel')} className="flex flex-none items-center gap-4 px-6 pt-3">
        <ol className="flex flex-1 gap-2">
          {cards.map((each, c) => {
            const tone = c === current ? 'bg-accent' : c < current ? (cardKind(each) === 'guess' ? 'bg-growth' : 'bg-accent/45') : 'bg-line';
            return (
              <li key={c} className="flex-1">
                <button
                  type="button"
                  onClick={() => go(c)}
                  aria-label={t('theory.goToCard', { n: c + 1 })}
                  aria-current={c === current ? 'step' : undefined}
                  className="group flex h-8 w-full items-center"
                >
                  <span className={`h-3 w-full rounded-full transition-colors ${tone} group-hover:bg-accent`} />
                </button>
              </li>
            );
          })}
        </ol>
        <span className="text-lg font-semibold tabular-nums text-ink-muted" aria-live="polite" data-testid="theory-position">
          {t('theory.cardOf', { n: current + 1, total: cards.length })}
        </span>
      </nav>

      <main
        ref={mainRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <article
          key={current}
          aria-roledescription={t('theory.cardRoleDescription')}
          className="success-open mx-auto w-full max-w-[64rem] overflow-hidden rounded-2xl border-2 border-line bg-surface"
        >
          <CardBand kind={cardKind(card)} />
          <div className="flex flex-col gap-5 px-6 py-5 text-xl leading-relaxed text-ink">
            {card.map((block, b) =>
              renderBlock(block, b, {
                inDeck: true,
                guess: (guessBlock) => {
                  const key = keyOf(current, b);
                  return (
                    <GuessView
                      guess={guessBlock.guess}
                      audience="class"
                      revealed={key in opened}
                      chosen={opened[key] ?? null}
                      onChoose={(option) => {
                        openedNow.current = true;
                        setOpened((previous) => ({ ...previous, [key]: option }));
                      }}
                    />
                  );
                }
              })
            )}
          </div>
        </article>
      </main>

      <footer className="flex flex-none items-center gap-4 border-t-2 border-line bg-shell px-6 py-3">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="inline-flex min-h-14 items-center gap-2 rounded-xl border-2 border-line bg-surface px-6 py-2 text-xl font-semibold text-ink hover:border-accent disabled:invisible"
        >
          <span aria-hidden="true">←</span>
          {t('theory.prev')}
        </button>
        <span className="flex-1" />
        {hidden || current < last ? (
          <button
            type="button"
            onClick={forward}
            className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-accent px-9 py-2 text-xl font-bold text-surface hover:brightness-110"
            data-testid="present-forward"
          >
            {hidden ? t('present.reveal') : t('theory.next')}
            {!hidden && <span aria-hidden="true">→</span>}
          </button>
        ) : (
          <span className="text-lg font-semibold text-ink-muted" data-testid="present-end">
            {t('present.end')}
          </span>
        )}
      </footer>
    </div>
  );
}
