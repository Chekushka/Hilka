'use client';

/**
 * How a graded session is graded, above the student's task list: the rules
 * and the 12-point scale (lib/grading/explain.ts, built from the grading
 * config). Students are owed both — what they get and for what — before they
 * start, and can fold it away once they know it.
 *
 * Not a paragraph of rules: each rule is a card with its number large in front
 * (1×, 70%, 10–12) and a short bold line, the detail under it in small type —
 * read from the back row and at a glance (project owner: contrast, not dry
 * text). The rule that costs most to miss — one attempt, or fixes at a lower
 * credit — spans the full width in the attention colour.
 */
import { LevelChip, pointsText } from '@/components/task/TaskCriteria';
import { gradingScale, sessionRules, type Rule, type RuleKey, type RulesInput, type ScaleLevelKey } from '@/lib/grading/explain';
import { t } from '@/lib/i18n';

const percentFormat = new Intl.NumberFormat('uk', { maximumFractionDigits: 1 });

type Tone = 'attention' | 'accent' | 'growth' | 'honey';

const BADGE_TONE: Record<Tone, string> = {
  attention: 'bg-attention text-on-bright',
  accent: 'bg-accent text-surface',
  growth: 'bg-growth text-on-bright',
  honey: 'bg-honey text-on-bright'
};

type CardRuleKey = Exclude<RuleKey, 'teacherDecides'>;

const RULE_TONE: Record<CardRuleKey, Tone> = {
  firstCheckOnly: 'attention',
  homeworkFirstCheck: 'growth',
  homeworkFixes: 'attention',
  runIsFree: 'accent',
  crashNotCounted: 'accent',
  points: 'honey',
  partialCases: 'accent',
  hints: 'honey',
  timeLimit: 'accent',
  improvement: 'growth',
  classCheck: 'accent',
  highBand: 'growth',
  homeworkHighBand: 'growth',
  highBandUnavailable: 'honey'
};

/** The rules a student must not miss: the whole row, outlined in the attention colour. */
const LEAD: RuleKey[] = ['firstCheckOnly', 'homeworkFixes'];

/** The scale's levels, tinted from quiet to bright, so the top of the scale reads as the goal. */
const LEVEL_TONE: Record<ScaleLevelKey, string> = {
  initial: 'border-line bg-shell',
  average: 'border-accent/30 bg-accent-soft',
  sufficient: 'border-growth/50 bg-growth/15',
  high: 'border-honey bg-honey-soft'
};

function ruleValues(rule: Rule): Record<string, string | number> {
  const values: Record<string, string | number> = { ...rule.values };
  for (const [key, value] of Object.entries(rule.values ?? {})) {
    if (key.startsWith('points')) values[key] = pointsText(value);
  }
  return values;
}

function RuleCard({ rule }: { rule: Rule }) {
  const key = rule.key as CardRuleKey;
  const values = ruleValues(rule);
  const lead = LEAD.includes(rule.key);
  return (
    <li
      data-testid={`rule-${rule.key}`}
      className={`flex items-start gap-3 rounded-xl bg-surface p-3 ${
        lead ? 'border-2 border-attention sm:col-span-2' : 'border border-line'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-12 min-w-12 flex-none items-center justify-center rounded-lg px-2 text-lg font-extrabold tabular-nums ${BADGE_TONE[RULE_TONE[key]]}`}
      >
        {t(`grading.rules.${key}.badge`, values)}
      </span>
      <div className="min-w-0 space-y-1">
        <p className={`font-bold text-ink ${lead ? 'text-lg' : 'text-base'}`}>{t(`grading.rules.${key}.title`, values)}</p>
        {key === 'points' && (
          // The three levels as the same marks the task list uses, so the student matches them by colour.
          <p className="flex flex-wrap gap-1.5">
            <LevelChip difficulty={1} />
            <LevelChip difficulty={3} />
            <LevelChip difficulty={5} />
          </p>
        )}
        <p className="text-sm text-ink-muted">{t(`grading.rules.${key}.body`, values)}</p>
      </div>
    </li>
  );
}

export function GradingRules({ input, defaultOpen }: { input: RulesInput; defaultOpen: boolean }) {
  const rules = sessionRules(input);
  if (rules.length === 0) return null;
  const scale = gradingScale();
  const cards = rules.filter((rule) => rule.key !== 'teacherDecides');
  const footer = rules.some((rule) => rule.key === 'teacherDecides');
  const title = input.kind === 'homework' ? t('grading.rulesTitleHomework') : t('grading.rulesTitleLesson');
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border-2 border-accent bg-surface shadow-[var(--shadow-raised)]"
      data-testid="grading-rules"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-accent px-4 py-3 text-surface">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-base font-extrabold text-accent"
        >
          ★
        </span>
        <span className="flex-1 text-lg font-bold">{title}</span>
        <span className="text-sm font-semibold underline-offset-2 group-hover:underline">
          <span className="group-open:hidden">{t('grading.show')}</span>
          <span className="hidden group-open:inline">{t('grading.hide')}</span>
        </span>
      </summary>

      <div className="space-y-5 p-4">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {cards.map((rule) => (
            <RuleCard key={rule.key} rule={rule} />
          ))}
        </ul>

        <section aria-labelledby="grading-scale-title" className="space-y-2">
          <h3 id="grading-scale-title" className="text-lg font-bold text-ink">
            {t('grading.scaleTitle')}
          </h3>
          <p className="text-sm text-ink-muted">{t('grading.scaleIntro')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="grading-scale">
            {scale.map((level) => (
              <section key={level.level} className={`rounded-lg border-2 px-3 py-2 ${LEVEL_TONE[level.level]}`}>
                <h4 className="text-xs font-bold uppercase tracking-wide text-ink">{t(`grading.scaleLevel.${level.level}`)}</h4>
                <dl className="mt-1 space-y-0.5 text-sm">
                  {level.rows.map((row) => (
                    <div key={row.grade} className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                      {/* The level above names what the numbers are; a screen reader hears the word too. */}
                      <dt className="text-lg font-extrabold tabular-nums text-ink">
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
        </section>

        {footer && (
          <p className="flex items-center gap-2.5 rounded-lg bg-shell px-3 py-2.5 text-sm text-ink" data-testid="rule-teacherDecides">
            <span aria-hidden="true" className="text-base font-bold text-accent">
              ✎
            </span>
            <span>
              <strong>{t('grading.rules.teacherDecides.title')}.</strong> {t('grading.rules.teacherDecides.body')}
            </span>
          </p>
        )}
      </div>
    </details>
  );
}
