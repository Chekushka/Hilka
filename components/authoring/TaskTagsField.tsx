'use client';

/**
 * Choosing a task's tags (lib/task/tags.ts): three toggle chips, each with a
 * line saying what it means, so a teacher tags by what the student will do
 * rather than guessing what a word was meant to cover.
 *
 * `TaskTagsField` is controlled, for the new-task form. `TaskTagsEditor` saves
 * on its own (`PUT /api/tasks/[id]/tags`) and sits on the task page for a draft
 * and a published task alike — tags never need a new version.
 */
import { useState } from 'react';
import { tagChipClass, tagGlyph } from '@/components/authoring/TaskBadges';
import { t } from '@/lib/i18n';
import { TASK_TAGS, normalizeTags, type TaskTag } from '@/lib/task/tags';

export function TaskTagsField({
  value,
  onChange,
  disabled = false
}: {
  value: readonly TaskTag[];
  onChange: (tags: TaskTag[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm text-ink-muted">{t('catalog.tagsFieldLabel')}</legend>
      <ul className="flex flex-col gap-2">
        {TASK_TAGS.map((tag) => {
          const on = value.includes(tag);
          return (
            <li key={tag}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                  on ? tagChipClass(tag) : 'border-line hover:border-ink-muted'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--accent)]"
                  checked={on}
                  onChange={(event) =>
                    onChange(normalizeTags(event.target.checked ? [...value, tag] : value.filter((v) => v !== tag)))
                  }
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span aria-hidden="true">{tagGlyph(tag)}</span>
                    {t(`catalog.tag.${tag}`)}
                  </span>
                  <span className="block text-xs text-ink-muted">{t(`catalog.tagHint.${tag}`)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function TaskTagsEditor({ taskId, initialTags }: { taskId: string; initialTags: TaskTag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [saved, setSaved] = useState(initialTags);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = tags.join() !== saved.join();

  async function save() {
    setState('saving');
    const response = await fetch(`/api/tasks/${taskId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    }).catch(() => null);
    if (!response?.ok) {
      setState('error');
      return;
    }
    setSaved(tags);
    setState('saved');
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-5" aria-labelledby="task-tags-title">
      <h2 id="task-tags-title" className="text-base font-semibold text-ink">
        {t('catalog.tagsEditorTitle')}
      </h2>
      <p className="mb-3 mt-1 text-sm text-ink-muted">{t('catalog.tagsEditorNote')}</p>
      <TaskTagsField
        value={tags}
        onChange={(next) => {
          setTags(next);
          setState('idle');
        }}
        disabled={state === 'saving'}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || state === 'saving'}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50"
        >
          {state === 'saving' ? t('catalog.tagsSaving') : t('catalog.tagsSave')}
        </button>
        <span role="status" className="text-sm">
          {state === 'saved' && !dirty && <span className="text-growth">{t('catalog.tagsSaved')}</span>}
          {state === 'error' && <span className="text-attention">{t('catalog.tagsError')}</span>}
        </span>
      </div>
    </section>
  );
}
