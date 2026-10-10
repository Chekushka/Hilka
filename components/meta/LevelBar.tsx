/**
 * How far the student is through their current level, in honey (XP's colour)
 * and in words beside it — never the bar alone.
 */
import { levelProgress } from '@/lib/meta/character';
import { t } from '@/lib/i18n';

export function LevelBar({ xp }: { xp: number }) {
  const { level, levelXp, nextXp } = levelProgress(xp);
  const share = nextXp === null ? 1 : (xp - levelXp) / (nextXp - levelXp);
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuemin={levelXp}
        aria-valuemax={nextXp ?? xp}
        aria-valuenow={xp}
        aria-label={t('character.level', { level })}
        className="h-2.5 overflow-hidden rounded-full bg-honey-soft ring-1 ring-honey/40"
      >
        <div className="h-full rounded-full bg-honey" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p className="text-xs text-ink-muted" data-testid="level-next">
        {nextXp === null ? t('character.maxLevel') : t('character.toNext', { level: level + 1, xp: nextXp - xp })}
      </p>
    </div>
  );
}
