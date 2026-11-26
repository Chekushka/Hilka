'use client';

/**
 * How a graded session is graded, above the student's task list: the rules
 * and the 12-point scale (lib/grading/explain.ts, built from the grading
 * config). Students are owed both — what they get and for what — before they
 * start, and can fold it away once they know it.
 */
import { pointsText } from '@/components/task/TaskCriteria';
import { gradingScale, sessionRules, type RulesInput } from '@/lib/grading/explain';
import { t } from '@/lib/i18n';

const percentFormat = new Intl.NumberFormat('uk', { maximumFractionDigits: 1 });

export function GradingRules({ input, defaultOpen }: { input: RulesInput; defaultOpen: boolean }) {
  const rules = sessionRules(input);
  if (rules.length === 0) return null;
  const scale = gradingScale();
  const title = input.kind === 'homework' ? t('grading.rulesTitleHomework') : t('grading.rulesTitleLesson');
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-line bg-surface px-4 py-3"
      data-testid="grading-rules"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 font-semibold text-ink">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-none items-center justify-center rounded border border-line text-xs font-bold"
        >
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
        {title}
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink">
        {rules.map((rule) => {
          const values: Record<string, string | number> = { ...rule.values };
          for (const [key, value] of Object.entries(rule.values ?? {})) {
            if (key.startsWith('points')) values[key] = pointsText(value);
          }
          return <li key={rule.key}>{t(`grading.rules.${rule.key}`, values)}</li>;
        })}
      </ul>
      <h3 className="mt-4 text-sm font-semibold text-ink">{t('grading.scaleTitle')}</h3>
      <p className="mt-1 text-sm text-ink-muted">{t('grading.scaleIntro')}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="grading-scale">
        {scale.map((level) => (
          <section key={level.level} className="rounded-md bg-shell px-3 py-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t(`grading.scaleLevel.${level.level}`)}
            </h4>
            <dl className="mt-1 space-y-0.5 text-sm">
              {level.rows.map((row) => (
                <div key={row.grade} className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                  {/* The level above names what the numbers are; a screen reader hears the word too. */}
                  <dt className="text-base font-bold tabular-nums text-ink">
                    <span className="sr-only">{t('grading.scaleGrade')} </span>
                    {row.grade}
                  </dt>
                  <dd className="tabular-nums text-ink-muted">
                    {row.grade === 1
                      ? t('grading.scaleRangeFirst', { to: percentFormat.format(row.to) })
                      : t('grading.scaleRange', { from: percentFormat.format(row.from), to: percentFormat.format(row.to) })}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </details>
  );
}
