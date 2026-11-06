import { describe, expect, it } from 'vitest';
import {
  applyRevisionPatch,
  authoringModeOf,
  editableContent,
  revisionBlocker,
  revisionFromRow,
  type RevisableRow
} from './revision';
import type { TaskRevision } from './types';

function row(overrides: Partial<RevisableRow> = {}): RevisableRow {
  return {
    type: 'code',
    status: 'published',
    title: 'Більше з двох чисел',
    payload: { type: 'code', surface: 'console', prompt: 'Виведи більше.', starter: '' },
    checks: [{ kind: 'number_close', value: 7, tol: 0.01, which: 'last' }],
    cases: [{ stdin: ['3', '7'] }],
    hints: ['Порівняй через if.'],
    difficulty: 2,
    gradeTags: [7],
    params: null,
    revision: null,
    ...overrides
  };
}

const live = revisionFromRow({ ...row(), payload: row().payload! });

describe('authoringModeOf', () => {
  it('is draft for a draft, whatever else it holds', () => {
    expect(authoringModeOf(row({ status: 'draft' }))).toBe('draft');
  });

  it('is published for a published task with nothing open', () => {
    expect(authoringModeOf(row())).toBe('published');
  });

  it('is revision once a revision is open', () => {
    expect(authoringModeOf(row({ revision: live }))).toBe('revision');
  });

  it('locks a parameterized task and an archived one', () => {
    expect(authoringModeOf(row({ params: { side: { choice: ['50', '80'] } } }))).toBe('locked');
    expect(authoringModeOf(row({ status: 'archived' }))).toBe('locked');
  });
});

describe('revisionBlocker', () => {
  it('names why a revision cannot start', () => {
    expect(revisionBlocker(row())).toBeNull();
    expect(revisionBlocker(row({ status: 'draft' }))).toBe('not_published');
    expect(revisionBlocker(row({ payload: null }))).toBe('no_payload');
    expect(revisionBlocker(row({ params: { n: { int: [1, 3] } } }))).toBe('parameterized');
  });
});

describe('revisionFromRow', () => {
  it('copies every editable field of the live version', () => {
    expect(live).toEqual({
      title: 'Більше з двох чисел',
      payload: { type: 'code', surface: 'console', prompt: 'Виведи більше.', starter: '' },
      checks: [{ kind: 'number_close', value: 7, tol: 0.01, which: 'last' }],
      cases: [{ stdin: ['3', '7'] }],
      hints: ['Порівняй через if.'],
      difficulty: 2,
      gradeTags: [7]
    });
  });

  it('keeps no cases as null, and an empty list too', () => {
    expect(revisionFromRow({ ...row({ cases: [] }), payload: row().payload! }).cases).toBeNull();
    expect(revisionFromRow({ ...row({ cases: null }), payload: row().payload! }).cases).toBeNull();
  });
});

describe('editableContent', () => {
  it('is the open revision, not the live fields, while one is open', () => {
    const revision: TaskRevision = { ...live, title: 'Нова назва' };
    expect(editableContent(row({ revision }))?.title).toBe('Нова назва');
  });

  it("is a draft's own fields", () => {
    expect(editableContent(row({ status: 'draft' }))).toEqual(live);
  });

  it('is nothing for a published task with no revision open', () => {
    expect(editableContent(row())).toBeNull();
  });
});

describe('applyRevisionPatch', () => {
  it('changes only the fields the save sent', () => {
    const result = applyRevisionPatch('code', live, { title: 'Інша', hints: [] });
    expect(result).toEqual({ ok: true, revision: { ...live, title: 'Інша', hints: [] } });
  });

  it('clears cases on an empty list, as a draft save does', () => {
    const result = applyRevisionPatch('code', live, { cases: [] });
    expect(result.ok && result.revision.cases).toBeNull();
  });

  it('refuses a payload of another type', () => {
    const result = applyRevisionPatch('code', live, {
      payload: { type: 'quiz', prompt: 'Що?', options: ['а', 'б'], multiple: false }
    });
    expect(result).toEqual({ ok: false, error: 'type_changed' });
  });

  it('does not touch the revision it was given', () => {
    applyRevisionPatch('code', live, { title: 'Інша' });
    expect(live.title).toBe('Більше з двох чисел');
  });
});
