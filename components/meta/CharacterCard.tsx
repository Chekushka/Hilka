'use client';

/**
 * The character beside the lesson list on /practice: what XP is for, at a
 * glance — the character in its look, the level and its name, how far to the
 * next one and what that unlocks, and the way to dress it up. The reward
 * layer, like the garden under it; never on the workspace.
 */
import Link from 'next/link';
import { Character } from '@/components/meta/Character';
import { LevelBar } from '@/components/meta/LevelBar';
import { levelRankLabel, nextUnlockLabel } from '@/components/meta/character-text';
import { levelForXp, resolveLook } from '@/lib/meta/character';
import { totalXp, type XpTask } from '@/lib/meta/progress';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { t } from '@/lib/i18n';

export function CharacterCard({ tasks }: { tasks: readonly XpTask[] }) {
  const [progress] = useLocalProgress();
  const xp = totalXp(tasks, new Set(progress.completedTaskSlugs));
  const level = levelForXp(xp);
  const next = nextUnlockLabel(level);

  return (
    <section
      aria-labelledby="character-card-title"
      data-testid="character-card"
      className="rounded-lg border-2 border-honey/60 bg-surface px-4 py-4"
    >
      <div className="flex items-center gap-4">
        <Character look={resolveLook(progress.look, level)} size={88} />
        <div className="min-w-0 flex-1">
          <h2 id="character-card-title" className="text-base font-semibold text-ink">
            {t('character.title')}
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-honey-ink" data-testid="character-level">
            {levelRankLabel(level)}
          </p>
          <div className="mt-2">
            <LevelBar xp={xp} />
          </div>
        </div>
      </div>
      {next && <p className="mt-3 text-sm text-ink">{next}</p>}
      <Link
        href="/practice/character"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-honey px-4 py-2 text-sm font-bold text-on-honey hover:brightness-105"
      >
        {t('character.customize')}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
