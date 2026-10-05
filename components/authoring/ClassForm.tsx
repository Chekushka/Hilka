'use client';

/**
 * Creates or edits a class: a title, the grade it studies, and a roster
 * (docs/TASKS.md, "Class + roster management"). The roster is edited as a
 * list: one field adds a name and keeps the focus for the next, and pasting a
 * whole class list into it — a spreadsheet column, names with commas, a
 * numbered journal list — adds every name at once (lib/classes/roster.ts).
 * Names can be sorted, removed, and renamed; a rename is sent to the server
 * with the save, which moves the student's results to the new spelling, so a
 * typo fixed in October does not orphan September's work.
 *
 * It stays a plain array of names (CLAUDE.md rule 8): no accounts, no
 * per-name identifiers — the local ids below exist only while the form is open.
 */
import { useRouter } from 'next/navigation';
import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import {
  CLASS_GRADES,
  MAX_ROSTER_SIZE,
  addNames,
  compareNames,
  nameKey,
  normalizeName,
  parseNames,
  readName
} from '@/lib/classes/roster';
import { t } from '@/lib/i18n';

interface ClassFormProps {
  mode: 'create' | 'edit';
  classId?: string;
  initialTitle?: string;
  initialGrade?: number | null;
  initialRoster?: string[];
  /** Edit only: roster names that already have work in the class's sessions. */
  namesWithResults?: string[];
}

interface RosterItem {
  key: number;
  name: string;
  /** The name as stored when the form opened; null for a name added now. */
  original: string | null;
}

const fieldClass = 'rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function ClassForm({
  mode,
  classId,
  initialTitle = '',
  initialGrade = null,
  initialRoster = [],
  namesWithResults = []
}: ClassFormProps) {
  const router = useRouter();
  const nextKey = useRef(initialRoster.length);
  const addRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [grade, setGrade] = useState<number | null>(initialGrade);
  // A stored name with stray spaces is shown tidied and saved as a rename of itself, so its results follow.
  const [items, setItems] = useState<RosterItem[]>(() =>
    initialRoster.map((name, key) => ({ key, name: normalizeName(name), original: name }))
  );
  const [draft, setDraft] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [feedback, setFeedback] = useState<{ added: number; skipped: string[] } | null>(null);
  const [editing, setEditing] = useState<{ key: number; value: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withResults = new Set(namesWithResults);
  const names = items.map((item) => item.name);
  const keyCounts = new Map<string, number>();
  for (const name of names) keyCounts.set(nameKey(name), (keyCounts.get(nameKey(name)) ?? 0) + 1);
  const hasDuplicates = [...keyCounts.values()].some((count) => count > 1);
  const renamed = items.some((item) => item.original !== null && item.original !== item.name);

  function add(newNames: string[]) {
    const result = addNames(names, newNames);
    setItems((previous) => [
      ...previous,
      ...result.added.map((name) => ({ key: nextKey.current++, name, original: null }))
    ]);
    setFeedback({ added: result.added.length, skipped: result.skipped });
    setError(null);
  }

  function addDraft() {
    const name = readName(draft);
    if (name === '') return;
    add([name]);
    setDraft('');
    addRef.current?.focus();
  }

  // A text field drops line breaks on paste, so a pasted list is read here before that happens.
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (!/[\n\t,;]/u.test(text)) return;
    event.preventDefault();
    add(parseNames(text));
  }

  function remove(item: RosterItem) {
    const stored = item.original ?? item.name;
    if (withResults.has(stored) && !window.confirm(t('classForm.removeConfirm', { name: stored }))) return;
    setItems((previous) => previous.filter((other) => other.key !== item.key));
    if (editing?.key === item.key) setEditing(null);
  }

  function saveRename() {
    if (!editing) return;
    const value = readName(editing.value);
    if (value === '') {
      setEditing(null);
      return;
    }
    const taken = items.some((item) => item.key !== editing.key && nameKey(item.name) === nameKey(value));
    if (taken) {
      setEditing({ ...editing, error: true });
      return;
    }
    setItems((previous) => previous.map((item) => (item.key === editing.key ? { ...item, name: value } : item)));
    setEditing(null);
  }

  function sort() {
    setItems((previous) => [...previous].sort((a, b) => compareNames(a.name, b.name)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim().length === 0) {
      setError(t('classForm.noTitle'));
      return;
    }
    if (items.length === 0) {
      setError(t('classForm.noRoster'));
      return;
    }
    if (hasDuplicates) {
      setError(t('classForm.noDuplicates'));
      return;
    }
    if (items.length > MAX_ROSTER_SIZE) {
      setError(t('classForm.tooMany', { n: MAX_ROSTER_SIZE }));
      return;
    }

    const renames = items
      .filter((item) => item.original !== null && item.original !== item.name)
      .map((item) => ({ from: item.original, to: item.name }));

    setSaving(true);
    const response = await fetch(mode === 'create' ? '/api/classes' : `/api/classes/${classId}`, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), grade, roster: names, ...(mode === 'edit' ? { renames } : {}) })
    }).catch(() => null);

    if (!response?.ok) {
      setSaving(false);
      setError(t('classForm.saveError'));
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(t('classForm.deleteConfirm', { title: initialTitle }))) return;
    setDeleting(true);
    setError(null);
    const response = await fetch(`/api/classes/${classId}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setDeleting(false);
      setError(t('classForm.deleteError'));
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="title">
              {t('classForm.titleLabel')}
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="grade">
              {t('classForm.gradeLabel')}
            </label>
            <select
              id="grade"
              value={grade ?? ''}
              onChange={(event) => setGrade(event.target.value === '' ? null : Number(event.target.value))}
              className={fieldClass}
            >
              <option value="">{t('classForm.gradeNone')}</option>
              {CLASS_GRADES.map((option) => (
                <option key={option} value={option}>
                  {t('classForm.gradeOption', { grade: option })}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-ink-muted sm:col-span-2">{t('classForm.gradeNote')}</p>
        </div>

        <section aria-labelledby="roster-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="roster-title" className="text-base font-semibold text-ink">
              {t('classForm.rosterTitle', { n: items.length })}
            </h2>
            {items.length > 1 && (
              <button type="button" onClick={sort} className="text-sm text-accent">
                {t('classForm.sort')}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-muted" htmlFor="add-student">
              {t('classForm.addLabel')}
            </label>
            <div className="flex gap-2">
              <input
                ref={addRef}
                id="add-student"
                type="text"
                value={draft}
                placeholder={t('classForm.addPlaceholder')}
                onChange={(event) => setDraft(event.target.value)}
                onPaste={handlePaste}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addDraft();
                  }
                }}
                className={`min-w-0 flex-1 ${fieldClass}`}
              />
              <button
                type="button"
                onClick={addDraft}
                disabled={readName(draft) === ''}
                className="rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
              >
                {t('classForm.add')}
              </button>
            </div>
            <p className="text-xs text-ink-muted">{t('classForm.addNote')}</p>
          </div>

          <div>
            <button
              type="button"
              aria-expanded={pasteOpen}
              onClick={() => setPasteOpen((open) => !open)}
              className="text-sm text-accent"
            >
              {pasteOpen ? '▾' : '▸'} {t('classForm.pasteToggle')}
            </button>
            {pasteOpen && (
              <div className="mt-2 flex flex-col gap-2">
                <label className="text-sm text-ink-muted" htmlFor="paste-students">
                  {t('classForm.pasteLabel')}
                </label>
                <textarea
                  id="paste-students"
                  rows={6}
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={t('classForm.pastePlaceholder')}
                  className={`font-mono text-sm ${fieldClass}`}
                />
                <button
                  type="button"
                  disabled={parseNames(pasteText).length === 0}
                  onClick={() => {
                    add(parseNames(pasteText));
                    setPasteText('');
                  }}
                  className="self-start rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
                >
                  {t('classForm.pasteAdd')}
                </button>
              </div>
            )}
          </div>

          {feedback && (
            <p className="text-sm text-ink" aria-live="polite" data-testid="roster-feedback">
              {t('classForm.added', { n: feedback.added })}
              {feedback.skipped.length > 0 && <> {t('classForm.skipped', { names: feedback.skipped.join(', ') })}</>}
            </p>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('classForm.rosterEmpty')}</p>
          ) : (
            <ol className="divide-y divide-line rounded-md border border-line" data-testid="roster-list">
              {items.map((item, index) => {
                const stored = item.original ?? item.name;
                const duplicate = (keyCounts.get(nameKey(item.name)) ?? 0) > 1;
                const isEditing = editing?.key === item.key;
                return (
                  <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="w-6 text-right tabular-nums text-ink-muted">{index + 1}</span>
                    {isEditing ? (
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          aria-label={t('classForm.renameLabel', { name: item.name })}
                          value={editing.value}
                          onChange={(event) => setEditing({ ...editing, value: event.target.value, error: false })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              saveRename();
                            } else if (event.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                          className={`min-w-0 flex-1 py-1 ${fieldClass}`}
                        />
                        <button type="button" onClick={saveRename} className="text-accent">
                          {t('classForm.renameSave')}
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className="text-ink-muted">
                          {t('classForm.renameCancel')}
                        </button>
                        {editing.error && <span className="w-full text-attention">{t('classForm.renameTaken')}</span>}
                      </span>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 text-ink">
                          {item.name}
                          {item.original !== null && item.original !== item.name && (
                            <span className="ml-2 text-xs text-ink-muted">
                              {t('classForm.renamedFrom', { name: item.original })}
                            </span>
                          )}
                        </span>
                        {withResults.has(stored) && (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                            {t('classForm.hasResults')}
                          </span>
                        )}
                        {duplicate && (
                          <span className="rounded-full border border-attention px-2 py-0.5 text-xs text-attention">
                            {t('classForm.duplicate')}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing({ key: item.key, value: item.name, error: false })}
                          className="text-accent"
                        >
                          {t('classForm.rename')}
                        </button>
                        <button
                          type="button"
                          aria-label={t('classForm.removeLabel', { name: item.name })}
                          onClick={() => remove(item)}
                          className="text-ink-muted hover:text-ink"
                        >
                          {t('classForm.remove')}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {mode === 'edit' && (renamed || namesWithResults.length > 0) && (
            <p className="text-xs text-ink-muted">{t('classForm.renameNote')}</p>
          )}
        </section>

        {error && (
          <p className="text-sm text-attention" role="status">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || deleting}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
        >
          {saving ? t('classForm.saving') : mode === 'create' ? t('classForm.create') : t('classForm.save')}
        </button>
      </form>

      {mode === 'edit' && (
        <section aria-labelledby="danger-title" className="mt-10 rounded-lg border border-line p-4">
          <h2 id="danger-title" className="text-base font-semibold text-ink">
            {t('classForm.dangerTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('classForm.dangerNote')}</p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="mt-3 rounded-md border border-attention px-4 py-2 text-sm text-attention disabled:opacity-50"
          >
            {deleting ? t('classForm.deleting') : t('classForm.delete')}
          </button>
        </section>
      )}
    </>
  );
}
