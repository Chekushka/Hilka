'use client';

/**
 * XP and topic progress above the lesson list — the reward layer, kept off the
 * workspace (docs/design-brief-python-platform.md, "The workspace is a tool.
 * The reward layer is a garden."). Client-side only because completed tasks
 * live in localStorage; the task list itself was read by the server page
 * (CLAUDE.md rule 4). Honey carries XP, growth carries progress, and every
 * bar also says its numbers in words — never color alone.
 */
import { useLocalProgress } from '@/lib/practice/local-progress';
import { topicProgress, totalXp, type PracticeTaskMeta } from '@/lib/meta/progress';
import { t } from '@/lib/i18n';

export function ProgressSummary({ tasks, grade }: { tasks: PracticeTaskMeta[]; grade: number }) {
  const [progress] = useLocalProgress();
  const completed = new Set(progress.completedTaskSlugs);
  const xp = totalXp(tasks, completed);
  const topics = topicProgress(tasks, completed, grade);
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby="progress-summary-title" className="rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="progress-summary-title" className="text-base font-semibold text-ink">
          {t('meta.title')}
        </h2>
        <p className="text-lg font-semibold text-honey" data-testid="xp-total">
          {t('meta.xpTotal', { xp })}
        </p>
      </div>
      {xp === 0 && <p className="mt-1 text-sm text-ink-muted">{t('meta.xpEmpty')}</p>}
      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {topics.map((topic) => {
          const complete = topic.done === topic.total;
          return (
            <div key={topic.slug} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span id={`topic-${topic.slug}`} className="text-ink">
                  {topic.title}
                </span>
                <span className={`shrink-0 whitespace-nowrap ${complete ? 'text-growth' : 'text-ink-muted'}`}>
                  {complete ? '✓ ' : ''}
                  {t('lessons.tasksDone', { done: topic.done, total: topic.total })}
                </span>
              </div>
              <div
                role="progressbar"
                aria-labelledby={`topic-${topic.slug}`}
                aria-valuemin={0}
                aria-valuemax={topic.total}
                aria-valuenow={topic.done}
                className="h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div className="h-full rounded-full bg-growth" style={{ width: `${(topic.done / topic.total) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
