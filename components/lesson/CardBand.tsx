/**
 * What a theory card is — an idea, a question, a rule to keep — as a band in
 * its own fill and icon, never the colour alone. Shared by the student's deck
 * and the projector's (components/lesson/TheoryDeck.tsx, PresentDeck.tsx).
 */
import type { ReactNode } from 'react';
import type { CardKind } from '@/lib/lessons/theory';
import { t } from '@/lib/i18n';

const BAND: Record<CardKind, { className: string; label: string; icon: ReactNode }> = {
  idea: { className: 'bg-accent-soft text-accent', label: 'theory.kindIdea', icon: <BulbIcon /> },
  guess: { className: 'bg-accent text-surface', label: 'theory.guessLabel', icon: <QuestionIcon /> },
  remember: { className: 'bg-honey text-on-bright', label: 'theory.remember', icon: <StarIcon /> }
};

/** What the card is, in its own colour and icon — never the colour alone. */
export function CardBand({ kind }: { kind: CardKind }) {
  const band = BAND[kind];
  return (
    <p className={`mt-3 flex items-center gap-2.5 px-5 py-2.5 text-base font-bold ${band.className}`} data-testid="card-band">
      {band.icon}
      {t(band.label)}
    </p>
  );
}

export function BulbIcon() {
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
