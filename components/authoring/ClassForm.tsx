'use client';

/**
 * Creates or edits a class: a title and a roster (docs/TASKS.md, "Class +
 * roster management"). The roster is a plain-text field, one display name
 * per line — same convention as hints/gradeTags in task authoring
 * (task-form-utils.ts's parseHints), not a dynamic add/remove list, and it
 * stays a plain array of names (CLAUDE.md rule 8): no accounts, no per-name
 * identifiers.
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { parseHints } from '@/components/authoring/task-form-utils';
import { t } from '@/lib/i18n';

interface ClassFormProps {
  mode: 'create' | 'edit';
  classId?: string;
  initialTitle?: string;
  initialRoster?: string[];
}

export function ClassForm({ mode, classId, initialTitle = '', initialRoster = [] }: ClassFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [rosterText, setRosterText] = useState(initialRoster.join('\n'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const roster = parseHints(rosterText);
    if (title.trim().length === 0) {
      setError(t('classForm.noTitle'));
      return;
    }
    if (roster.length === 0) {
      setError(t('classForm.noRoster'));
      return;
    }

    setSaving(true);
    const response = await fetch(mode === 'create' ? '/api/classes' : `/api/classes/${classId}`, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), roster })
    });

    if (!response.ok) {
      setSaving(false);
      setError(t('classForm.saveError'));
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="title">
          {t('classForm.titleLabel')}
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-ink-muted" htmlFor="roster">
          {t('classForm.rosterLabel')}
        </label>
        <textarea
          id="roster"
          rows={8}
          value={rosterText}
          onChange={(event) => setRosterText(event.target.value)}
          placeholder={t('classForm.rosterPlaceholder')}
          className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
        />
      </div>

      {error && <p className="text-sm text-attention">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {saving ? t('classForm.saving') : mode === 'create' ? t('classForm.create') : t('classForm.save')}
      </button>
    </form>
  );
}
