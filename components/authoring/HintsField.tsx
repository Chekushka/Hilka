'use client';

/**
 * Hints as an ordered add/remove list, and grade tags as checkboxes — the
 * plain-text fields they replace ("one per line", "7, 8") are still what the
 * forms hold and parse (task-form-utils.ts's parseHints/parseGradeTags), so
 * nothing downstream changes. The list keeps its own rows, empty ones
 * included, because an empty hint vanishes from the joined text the moment
 * it is added; parseHints drops them again on save.
 */
import { useState } from 'react';
import { RowButton } from '@/components/authoring/ChecksField';
import { moveItem } from '@/lib/task/check-form';
import { t } from '@/lib/i18n';

export function HintsField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [hints, setHints] = useState<string[]>(() => (value === '' ? [''] : value.split('\n')));

  function update(next: string[]) {
    setHints(next);
    onChange(next.join('\n'));
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm text-ink-muted">{t('authoring.hintsLabel')}</legend>
      {hints.length === 0 && <p className="text-sm text-ink-muted">{t('builder.hintsEmpty')}</p>}
      {hints.map((hint, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* The number in a honey badge, as the mockups draw it; the label text stays for screen readers. */}
          <label htmlFor={`hint-${index}`} className="shrink-0">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-honey text-xs font-bold text-surface"
            >
              {index + 1}
            </span>
            <span className="sr-only">{t('builder.hintNumber', { n: index + 1 })}</span>
          </label>
          <input
            id={`hint-${index}`}
            value={hint}
            onChange={(event) => update(hints.map((existing, at) => (at === index ? event.target.value : existing)))}
            className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <span className="flex gap-1 text-xs">
            <RowButton
              label={t('builder.moveUp')}
              disabled={index === 0}
              onClick={() => update(moveItem(hints, index, index - 1))}
            >
              ↑
            </RowButton>
            <RowButton
              label={t('builder.moveDown')}
              disabled={index === hints.length - 1}
              onClick={() => update(moveItem(hints, index, index + 1))}
            >
              ↓
            </RowButton>
            <RowButton label={t('builder.remove')} onClick={() => update(hints.filter((_, at) => at !== index))}>
              ✕
            </RowButton>
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update([...hints, ''])}
        className="self-start rounded-md border border-accent px-3 py-1.5 text-sm text-accent"
      >
        {t('builder.addHint')}
      </button>
    </fieldset>
  );
}

/** Grades the curriculum covers (docs/CURRICULUM.md). */
const GRADES = [7, 8, 9] as const;

export function GradeTagsField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const selected = new Set(
    value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  );
  // A grade outside 7–9 from an older task stays selected rather than silently dropped.
  const grades = [...new Set([...GRADES, ...selected])].sort((a, b) => a - b);

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm text-ink-muted">{t('authoring.gradeTagsLabel')}</legend>
      <div className="flex gap-2">
        {grades.map((grade) => (
          <label
            key={grade}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              selected.has(grade)
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={selected.has(grade)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(grade);
                else next.delete(grade);
                onChange([...next].sort((a, b) => a - b).join(', '));
              }}
            />
            {t('builder.grade', { grade })}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
