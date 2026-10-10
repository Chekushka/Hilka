/**
 * The frame every not-yet result is shown in, inside the result dock. None of it is
 * punishment: "not yet" is a quiet attention tone with an open circle or a
 * diamond, never red, never shaking, never "Error" as a heading. A pass is
 * celebrated in the task panel (SuccessPanel); the dock's body only notes it
 * (PassedNote), and the way on sits on the dock's bar (WorkspaceDock).
 *
 * Meaning is carried by the icon's shape and by the words as well as colour:
 * a class of twenty-five contains someone who cannot separate red from green.
 */
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';

export function ResultFrame({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <section className="rounded-lg border border-attention/50 border-l-4 border-l-attention bg-surface p-4" aria-live="polite">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-attention/15 text-base font-bold text-attention"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-attention">{title}</h3>
          <div className="mt-1 text-base leading-relaxed text-ink">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** The dock's line once a Check passed — the moment itself is SuccessPanel's. */
export function PassedNote() {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-growth">
      <span aria-hidden="true">✓</span>
      {t('result.passedDock')}
    </p>
  );
}
