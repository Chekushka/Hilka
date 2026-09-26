'use client';

/**
 * XP and the garden above the lesson list — one plant per topic, grown by the
 * share of its tasks done (lib/meta/garden.ts). The reward layer, kept off the
 * workspace (docs/design-brief-python-platform.md, "The workspace is a tool.
 * The reward layer is a garden."). Client-side only because completed tasks
 * live in localStorage; the task list itself was read by the server page
 * (CLAUDE.md rule 4). Honey carries XP, growth carries progress, and every
 * plant also says its numbers and its stage in words — never picture alone.
 */
import { useLocalProgress } from '@/lib/practice/local-progress';
import { Plant } from '@/components/meta/Plant';
import { plantStage } from '@/lib/meta/garden';
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
      <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-5">
        {topics.map((topic) => {
          const stage = plantStage(topic.done, topic.total);
          const complete = topic.done === topic.total;
          return (
            <div
              key={topic.slug}
              role="group"
              aria-label={topic.title}
              data-stage={stage}
              className="flex flex-col items-center gap-1 text-center"
            >
              <Plant stage={stage} size={40} />
              <span className="text-xs leading-tight text-ink">{topic.title}</span>
              <span className={`text-xs ${complete ? 'text-growth' : 'text-ink-muted'}`}>
                {complete ? '✓ ' : ''}
                {t('lessons.tasksDone', { done: topic.done, total: topic.total })}
                <span className="sr-only"> · {t(`garden.stage${stage}`)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
