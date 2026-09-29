import type { ReactNode } from 'react';

/**
 * One group of an authoring form, as a card — the task editor is dense and
 * unglamorous, so grouping is what makes it scannable
 * (docs/design-brief-python-platform.md, "Teacher").
 */
export function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
      {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}
