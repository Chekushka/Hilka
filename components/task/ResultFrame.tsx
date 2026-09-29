/**
 * The frame every result is shown in, inside the result dock. None of it is
 * punishment: "not yet" is a quiet attention tone with an open circle or a
 * diamond, never red, never shaking, never "Error" as a heading. Passing is
 * the one place generosity is allowed — the badge and the heading grow, and
 * the way on (NextTaskButton, with what was earned) sits right under them.
 *
 * Meaning is carried by the icon's shape and by the words as well as colour:
 * a class of twenty-five contains someone who cannot separate red from green.
 */
import type { ReactNode } from 'react';

export function ResultFrame({
  tone,
  icon,
  title,
  children
}: {
  tone: 'growth' | 'attention';
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  const passed = tone === 'growth';
  return (
    <section
      className={`rounded-lg border bg-surface ${passed ? 'border-growth p-5' : 'border-line p-4'}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`flex flex-none items-center justify-center rounded-full font-bold ${
            passed ? 'h-11 w-11 bg-growth text-xl text-surface' : 'h-8 w-8 bg-attention/15 text-base text-attention'
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold ${passed ? 'text-2xl text-growth' : 'text-lg text-attention'}`}>{title}</h3>
          <div className="mt-1 text-base leading-relaxed text-ink">{children}</div>
        </div>
      </div>
    </section>
  );
}
