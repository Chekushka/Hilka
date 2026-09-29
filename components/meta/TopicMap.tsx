'use client';

/**
 * The topic map (docs/mockups, the topic-map screen) — part of the reward
 * layer, so it may look like a garden and not like a tool. A grade's topics
 * as one branch growing upward: the first topic by the soil, each finished
 * stretch of the branch in growth green, the place to carry on marked, and a
 * honey bud at the tip for what is still to come.
 *
 * The mockup lays the topics on a fixed 980×470 tree; this draws the same
 * idea as a list, so any number of topics fits and a phone gets one column
 * with the branch down its left edge (from `md`, the topics alternate either
 * side of it). The DOM keeps curriculum order — only the picture grows
 * upward — and every state is said by the badge's shape and in words, never
 * by colour alone.
 */
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { topicMap, type MapLesson, type TopicMapNode, type TopicState } from '@/lib/meta/topic-map';
import type { PracticeTaskMeta } from '@/lib/meta/progress';
import { t } from '@/lib/i18n';

const noSubscription = () => () => {};

const TRUNK: Record<TopicState, string> = {
  done: 'bg-growth',
  current: 'bg-accent',
  started: 'bg-line',
  ahead: 'bg-line'
};

const STATE_WORD: Record<TopicState, string> = {
  done: 'topicMap.stateDone',
  current: 'topicMap.stateCurrent',
  started: 'topicMap.stateStarted',
  ahead: 'topicMap.stateAhead'
};

function Badge({ node, index }: { node: TopicMapNode; index: number }) {
  if (node.state === 'done') {
    return (
      <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-growth text-sm font-bold text-surface">
        ✓
      </span>
    );
  }
  if (node.state === 'current') {
    return (
      <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-surface">
        <span className="h-3 w-3 rounded-full bg-honey" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-[1.5px] text-xs font-bold ${
        node.state === 'started' ? 'border-accent text-accent' : 'border-line text-ink-muted'
      }`}
    >
      {index + 1}
    </span>
  );
}

function Node({ node, index, side }: { node: TopicMapNode; index: number; side: 'left' | 'right' }) {
  const current = node.state === 'current';
  const card = current
    ? 'border-accent bg-accent text-surface'
    : node.state === 'done'
      ? 'border-growth bg-surface text-ink hover:bg-bg'
      : 'border-line bg-surface text-ink hover:border-accent';
  return (
    <Link
      href={node.href}
      id={current ? 'topic-current' : undefined}
      className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 md:w-auto md:max-w-sm ${
        current ? 'py-4' : 'py-3'
      } ${card} ${side === 'left' ? 'md:flex-row-reverse md:text-right' : ''}`}
    >
      <Badge node={node} index={index} />
      <span className="min-w-0 flex-1">
        <span className={`block leading-snug ${current ? 'text-lg font-semibold' : 'font-medium'}`}>{node.title}</span>
        <span className={`block text-sm ${current ? 'opacity-80' : 'text-ink-muted'}`}>
          {t('lessons.tasksDone', { done: node.done, total: node.total })}
          <span className="sr-only"> · {t(STATE_WORD[node.state])}</span>
        </span>
      </span>
      {current && (
        <span aria-hidden="true" className="flex-none text-sm font-semibold">
          {t('topicMap.continue')} →
        </span>
      )}
    </Link>
  );
}

export function TopicMap({ lessons, tasks, grade }: { lessons: MapLesson[]; tasks: PracticeTaskMeta[]; grade: number }) {
  const [progress] = useLocalProgress();
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const nodes = topicMap(lessons, tasks, new Set(progress.completedTaskSlugs), grade);
  const currentSlug = nodes.find((node) => node.state === 'current')?.slug;
  const doneCount = nodes.filter((node) => node.state === 'done').length;

  // The branch grows upward, so the place to carry on can be below the fold —
  // bring it into view once the browser's own progress is known.
  useEffect(() => {
    if (!hydrated || !currentSlug) return;
    document.getElementById('topic-current')?.scrollIntoView({ block: 'center' });
  }, [hydrated, currentSlug]);

  if (nodes.length === 0) {
    return <p className="mt-6 text-ink-muted">{t('topicMap.empty')}</p>;
  }

  return (
    <div className="mt-4">
      <p className="text-ink-muted">{t('topicMap.summary', { grade, done: doneCount, total: nodes.length })}</p>
      <ul aria-label={t('topicMap.legendLabel')} className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-growth text-[0.7rem] font-bold text-surface">
            ✓
          </span>
          {t('topicMap.legendDone')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
            <span className="h-2 w-2 rounded-full bg-honey" />
          </span>
          {t('topicMap.legendCurrent')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-5 w-5 rounded-full border-[1.5px] border-line" />
          {t('topicMap.legendAhead')}
        </li>
      </ul>

      <div className="mt-6 flex flex-col">
        {/* The tip: a bud for what is still to come. */}
        <div aria-hidden="true" className="grid grid-cols-[3rem_1fr] md:grid-cols-[1fr_3rem_1fr]">
          <span className="flex justify-center md:col-start-2">
            <span className="h-4 w-4 rounded-full bg-honey" />
          </span>
        </div>
        <ol className="flex flex-col-reverse">
          {nodes.map((node, index) => {
            const side = index % 2 === 0 ? 'right' : 'left';
            // Thicker by the soil, thinner toward the tip, like a real branch.
            const thickness = Math.max(4, 12 - Math.round((8 * index) / Math.max(1, nodes.length - 1)));
            return (
              <li key={node.slug} className="grid grid-cols-[3rem_1fr] md:grid-cols-[1fr_3rem_1fr]">
                <span aria-hidden="true" className="relative flex items-center justify-center md:col-start-2 md:row-start-1">
                  <span className={`absolute inset-y-0 ${TRUNK[node.state]}`} style={{ width: thickness }} />
                  <span className={`relative h-4 w-4 rounded-full ring-4 ring-bg ${TRUNK[node.state]}`} />
                </span>
                <span
                  className={`flex items-center py-2 md:row-start-1 ${
                    side === 'left' ? 'md:col-start-1 md:flex-row-reverse' : 'md:col-start-3'
                  }`}
                >
                  {/* The twig from the branch to the topic. */}
                  <span aria-hidden="true" className={`h-[3px] w-3 flex-none md:w-6 ${TRUNK[node.state]}`} />
                  <Node node={node} index={index} side={side} />
                </span>
              </li>
            );
          })}
        </ol>
        {/* The soil the branch grows from. */}
        <div aria-hidden="true" className="grid grid-cols-[3rem_1fr] md:grid-cols-[1fr_3rem_1fr]">
          <span className="flex justify-center md:col-start-2">
            <span className="h-3 w-20 rounded-full bg-soil" />
          </span>
        </div>
      </div>
    </div>
  );
}
