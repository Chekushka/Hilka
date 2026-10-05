/**
 * How a task's difficulty, tags and type look wherever a teacher chooses
 * tasks — the task list, the session builder's bank, the task page. One look
 * everywhere, so a challenge tag or a difficulty of 4 reads the same on every screen.
 *
 * Meaning is never colour alone: the meter has a word and a count beside its
 * pips, and every tag chip has a glyph and its name.
 */
import { t } from '@/lib/i18n';
import { difficultyBand } from '@/lib/task/catalog-filter';
import type { TaskTag } from '@/lib/task/tags';
import type { TaskType } from '@/lib/task/types';

const BAND_FILL = {
  easy: 'bg-growth',
  medium: 'bg-honey',
  hard: 'bg-attention'
} as const;

/** Five pips, as many filled as the difficulty, and its number and word for a screen reader and the eye. */
export function DifficultyMeter({ difficulty, compact = false }: { difficulty: number; compact?: boolean }) {
  const band = difficultyBand(difficulty);
  const label = t('catalog.difficultyLabel', { n: difficulty, band: t(`catalog.band.${band}`) });
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={label} data-testid="difficulty-meter">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((pip) => (
          <span
            key={pip}
            className={`h-2.5 w-1.5 rounded-sm ${pip <= difficulty ? BAND_FILL[band] : 'bg-line'}`}
          />
        ))}
      </span>
      {!compact && (
        <span aria-hidden="true" className="text-xs tabular-nums text-ink-muted">
          {difficulty}
        </span>
      )}
    </span>
  );
}

const TAG_STYLE: Record<TaskTag, { glyph: string; className: string }> = {
  retype: { glyph: '⌨', className: 'border-accent/40 bg-accent-soft text-accent' },
  'easy-start': { glyph: '↗', className: 'border-growth/50 bg-growth/10 text-ink' },
  challenge: { glyph: '★', className: 'border-honey/60 bg-honey/15 text-ink' }
};

export function tagGlyph(tag: TaskTag): string {
  return TAG_STYLE[tag].glyph;
}

export function tagChipClass(tag: TaskTag): string {
  return TAG_STYLE[tag].className;
}

export function TaskTagChip({ tag }: { tag: TaskTag }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${TAG_STYLE[tag].className}`}
      title={t(`catalog.tagHint.${tag}`)}
    >
      <span aria-hidden="true">{TAG_STYLE[tag].glyph}</span>
      {t(`catalog.tag.${tag}`)}
    </span>
  );
}

export function TaskTypeChip({ type }: { type: TaskType }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-shell px-2.5 py-1 text-xs text-ink-muted">
      {t(`task.types.${type}`)}
    </span>
  );
}
