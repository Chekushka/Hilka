/**
 * The two switches above practice: which view (the lesson list or the topic
 * map) and which grade. Plain links, so each state has its own address and
 * the back button works; large enough to hit with a thumb.
 */
import Link from 'next/link';
import { t } from '@/lib/i18n';

const pill = 'rounded-full border px-4 py-1.5 text-sm';
const on = 'border-accent bg-accent-soft font-medium text-ink';
const off = 'border-line text-ink-muted hover:border-accent';

export function PracticeNav({ view, grade, grades }: { view: 'lessons' | 'map'; grade?: number; grades: number[] }) {
  const query = grade === undefined ? '' : `?grade=${grade}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      <nav aria-label={t('topicMap.viewLabel')} className="flex gap-2">
        <Link href={`/practice${query}`} aria-current={view === 'lessons' ? 'page' : undefined} className={`${pill} ${view === 'lessons' ? on : off}`}>
          {t('topicMap.viewLessons')}
        </Link>
        <Link href={`/practice/map${query}`} aria-current={view === 'map' ? 'page' : undefined} className={`${pill} ${view === 'map' ? on : off}`}>
          {t('topicMap.viewMap')}
        </Link>
      </nav>
      {grades.length > 1 && (
        <nav aria-label={t('lessons.gradeLabel')} className="flex gap-2">
          {grades.map((option) => (
            <Link
              key={option}
              href={`${view === 'map' ? '/practice/map' : '/practice'}?grade=${option}`}
              aria-current={option === grade ? 'page' : undefined}
              className={`${pill} ${option === grade ? on : off}`}
            >
              {t('lessons.gradeOption', { grade: option })}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
