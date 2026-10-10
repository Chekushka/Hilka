'use client';

/**
 * Dressing the character up. Each slot offers its items drawn on the
 * character itself, so a student sees what they would get before choosing;
 * what their level has not reached yet is shown too, dimmed with the level
 * that opens it — the reason to earn the next XP. Choosing writes the look
 * into local progress (lib/practice/progress.ts), which a progress code
 * carries to another machine.
 */
import Link from 'next/link';
import { Character } from '@/components/meta/Character';
import { LevelBar } from '@/components/meta/LevelBar';
import { itemLabel, levelRankLabel, nextUnlockLabel } from '@/components/meta/character-text';
import {
  CHARACTER_ITEMS,
  CHARACTER_SLOTS,
  isUnlocked,
  levelForXp,
  resolveLook,
  type CharacterItem,
  type CharacterLook
} from '@/lib/meta/character';
import { totalXp, type XpTask } from '@/lib/meta/progress';
import { useLocalProgress } from '@/lib/practice/local-progress';
import { setLook } from '@/lib/practice/progress';
import { t } from '@/lib/i18n';

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 flex-none">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ItemOption({
  item,
  look,
  level,
  worn,
  onWear
}: {
  item: CharacterItem;
  look: CharacterLook;
  level: number;
  worn: boolean;
  onWear: () => void;
}) {
  const open = isUnlocked(item, level);
  const label = itemLabel(item);
  return (
    <li>
      <button
        type="button"
        onClick={onWear}
        disabled={!open}
        aria-pressed={open ? worn : undefined}
        aria-label={open ? label : t('character.lockedLabel', { item: label, level: item.level })}
        data-item={`${item.slot}:${item.id}`}
        className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 px-2 pb-2 pt-1 text-center ${
          worn
            ? 'border-accent bg-accent-soft'
            : open
              ? 'border-line bg-surface hover:border-accent'
              : 'cursor-not-allowed border-dashed border-line bg-bg'
        }`}
      >
        <span className={open ? '' : 'opacity-45'}>
          <Character look={{ ...look, [item.slot]: item.id }} size={64} />
        </span>
        <span className={`text-xs font-semibold ${open ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
        {worn ? (
          <span className="text-xs font-semibold text-accent">✓ {t('character.worn')}</span>
        ) : (
          !open && (
            <span className="flex items-center gap-1 whitespace-nowrap text-xs text-ink-muted">
              <LockIcon />
              {t('character.locked', { level: item.level })}
            </span>
          )
        )}
      </button>
    </li>
  );
}

export function CharacterEditor({ tasks }: { tasks: readonly XpTask[] }) {
  const [progress, setProgress] = useLocalProgress();
  const xp = totalXp(tasks, new Set(progress.completedTaskSlugs));
  const level = levelForXp(xp);
  const look = resolveLook(progress.look, level);
  const next = nextUnlockLabel(level);

  function wear(item: CharacterItem) {
    setProgress((previous) => setLook(previous, { ...previous.look, [item.slot]: item.id }));
  }

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <section
        aria-labelledby="character-preview-title"
        className="flex flex-col items-center rounded-xl border-2 border-honey/60 bg-surface px-5 py-6 text-center lg:sticky lg:top-6"
      >
        <h2 id="character-preview-title" className="sr-only">
          {t('character.preview')}
        </h2>
        <Character look={look} size={168} />
        <p className="mt-3 text-lg font-bold text-honey-ink" data-testid="character-level">
          {levelRankLabel(level)}
        </p>
        <p className="text-sm text-ink-muted">{t('meta.xpTotal', { xp })}</p>
        <div className="mt-3 w-full">
          <LevelBar xp={xp} />
        </div>
        {next && <p className="mt-3 text-sm text-ink">{next}</p>}
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">{t('character.savedNote')}</p>
      </section>

      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
          <p>{t('character.intro')}</p>
          <p className="mt-1 text-ink-muted">{t('character.howToEarn')}</p>
          <Link href="/practice" className="mt-2 inline-block font-semibold text-accent">
            {t('character.toLessons')} →
          </Link>
        </div>
        {CHARACTER_SLOTS.map((slot) => (
          <section key={slot} aria-labelledby={`slot-${slot}`}>
            <h2 id={`slot-${slot}`} className="text-base font-semibold text-ink">
              {t(`character.slots.${slot}`)}
            </h2>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {CHARACTER_ITEMS.filter((item) => item.slot === slot).map((item) => (
                <ItemOption
                  key={item.id}
                  item={item}
                  look={look}
                  level={level}
                  worn={look[slot] === item.id}
                  onWear={() => wear(item)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
