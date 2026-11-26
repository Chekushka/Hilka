'use client';

import { BulbIcon } from '@/components/lesson/CardBand';
import { CodeBlock, renderInline } from '@/components/lesson/Explanation';
import type { Guess } from '@/lib/lessons/markdown';
import { isAnswerable, optionOrder } from '@/lib/lessons/theory';
import { t } from '@/lib/i18n';

interface GuessViewProps {
  guess: Guess;
  /** The option picked, or null. */
  chosen: number | null;
  onChoose: (option: number) => void;
  /** The answer is shown although nothing was picked — the teacher opened it on the projector. */
  revealed?: boolean;
  /** Who is answering: one student at their screen, or the whole class voting in front of the projector. */
  audience?: 'student' | 'class';
}

/**
 * A guess card: the code, the outputs to choose from as lettered tiles, then
 * what it really prints — line by line, as if the program were running — and
 * why. One answer, never a retry and never a red mark: the point is to have
 * guessed before seeing it.
 */
export function GuessView({ guess, chosen, onChoose, revealed = false, audience = 'student' }: GuessViewProps) {
  if (!isAnswerable(guess)) return <CodeBlock text={guess.code} />;
  const answered = revealed || chosen !== null;
  const right = chosen === guess.answer;
  const letters = t('theory.optionLetters').split('');
  // On a wide projector the code is short and the screen low: the options go beside the code, and the answer
  // opens under the code, so the whole question and its answer fit on one screen.
  const wide = audience === 'class';

  return (
    <div
      className={wide ? 'grid gap-x-6 gap-y-4 lg:grid-cols-2 lg:items-start' : 'flex flex-col gap-4'}
      data-testid="guess-card"
    >
      <div className={wide ? 'lg:col-start-1 lg:row-start-1' : ''}>
        <CodeBlock text={guess.code} />
      </div>
      <div className={`flex flex-col gap-4 ${wide ? 'lg:col-start-2 lg:row-span-2 lg:row-start-1' : ''}`}>
        <p className="text-xl font-bold">{t('theory.guessQuestion')}</p>
        <div role="group" aria-label={t('theory.guessQuestion')} className={wide ? 'grid gap-2.5' : 'grid gap-2.5 sm:grid-cols-2'}>
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
                    <span className="text-sm font-semibold text-ink-muted">
                      {t(audience === 'class' ? 'present.classOption' : 'theory.yourOption')}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div aria-live="polite" className={wide ? 'lg:col-start-1 lg:row-start-2' : ''}>
        {answered && (
          <div className="flex flex-col gap-3" data-testid="guess-feedback">
            <p className={`flex items-center gap-2 text-xl font-bold ${right ? 'text-growth' : 'text-ink'}`}>
              {right && (
                <span aria-hidden="true" className="success-badge flex h-8 w-8 items-center justify-center rounded-full bg-growth text-on-bright">
                  ✓
                </span>
              )}
              {right ? t('theory.guessRight') : chosen === null ? t('present.answerIs') : t('theory.guessWrong')}
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
