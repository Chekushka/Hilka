import { describe, expect, it } from 'vitest';
import type { ContentBundle, LessonExport, TaskContent } from '@/lib/db/content-io';
import type { LessonContent } from '@/lib/lessons/types';
import { formatJson, inlineJson, planContentWrite, sameJson, taskFileContent, taskFileName, type ExistingContent } from './write-plan';

function task(overrides: Partial<TaskContent> = {}): TaskContent {
  return {
    slug: 'g7-quiz-a',
    topicSlug: 'intro',
    type: 'quiz',
    title: 'Питання',
    payload: { type: 'quiz', prompt: 'Що?', options: ['так', 'ні'], multiple: false },
    checks: [{ kind: 'choice_equals', indices: [0] }],
    hints: [],
    difficulty: 1,
    gradeTags: [7],
    version: 1,
    status: 'published',
    ...overrides
  };
}

function lesson(overrides: Partial<LessonExport> = {}): LessonExport {
  return {
    slug: 'g7-25-intro',
    grade: 7,
    order: 25,
    kind: 'mandatory',
    title: 'Перша програма',
    curriculumRef: '7:25',
    explanationMd: '# Вступ\n',
    coreTaskSlugs: ['g7-quiz-a'],
    additionalTaskSlugs: [],
    ...overrides
  };
}

const topic = { slug: 'intro', title: 'Вступ', order: 1, gradeTags: [7], curriculumRef: '7:25' };

function withoutExplanation(lesson: LessonExport): LessonContent {
  const rest: Partial<LessonExport> = { ...lesson };
  delete rest.explanationMd;
  return rest as LessonContent;
}

/** content/ exactly as the given bundle would have written it — a re-export with no edits. */
function existingFrom(bundle: ContentBundle): ExistingContent {
  return {
    topics: bundle.topics,
    tasks: new Map(bundle.tasks.map((item) => [item.slug, { file: taskFileName(item.slug), content: taskFileContent(item) }])),
    lessons: new Map([[7, (bundle.lessons ?? []).map(withoutExplanation)]]),
    explanations: new Map((bundle.lessons ?? []).map((item) => [`${item.grade}/${item.slug}`, item.explanationMd]))
  };
}

const bundle: ContentBundle = { topics: [topic], tasks: [task()], lessons: [lesson()] };

describe('planContentWrite', () => {
  it('writes nothing when content/ already matches the export', () => {
    const plan = planContentWrite(bundle, existingFrom(bundle));
    expect(plan.writes).toEqual([]);
    expect(plan.unchanged).toBe(4); // topics.json, one task, grade7.json, one explanation
  });

  it('ignores key order and derived reference data when deciding a task is unchanged', () => {
    const published = task({
      reference: { code: 'print(1)', computedAt: '2026-09-26T10:00:00Z', artifacts: { stdout: '1\n' } }
    });
    const existing = existingFrom({ topics: [topic], tasks: [task()] });
    const onDisk = { status: 'published', ...taskFileContent(published) };
    const plan = planContentWrite(
      { topics: [], tasks: [published] },
      { ...existing, tasks: new Map([[published.slug, { file: 'grade7-quiz-a.json', content: onDisk }]]) }
    );
    expect(plan.writes).toEqual([]);
  });

  it('rewrites only the task that changed, in the file it already lives in', () => {
    const existing = existingFrom(bundle);
    const renamed = { ...existing, tasks: new Map([['g7-quiz-a', { file: 'custom-name.json', content: taskFileContent(task()) }]]) };
    const plan = planContentWrite({ ...bundle, tasks: [task({ title: 'Нове питання' })] }, renamed);
    expect(plan.writes.map((write) => write.path)).toEqual(['seed-tasks/custom-name.json']);
    expect(JSON.parse(plan.writes[0].content).title).toBe('Нове питання');
  });

  it('names a new task file the way content/seed-tasks/ does', () => {
    const plan = planContentWrite({ topics: [], tasks: [task({ slug: 'g8-code-lists' })] }, existingFrom(bundle));
    expect(plan.writes.map((write) => write.path)).toEqual(['seed-tasks/grade8-code-lists.json']);
    expect(taskFileName('e2e-thing')).toBe('e2e-thing.json');
  });

  it('keeps only the reference code in git', () => {
    const content = taskFileContent(task({ reference: { code: 'x = 1', computedAt: 'now', artifacts: { stdout: '' } } }));
    expect(content.reference).toEqual({ code: 'x = 1' });
    expect(Object.keys(content)).toEqual(['slug', 'topicSlug', 'type', 'title', 'payload', 'checks', 'hints', 'reference', 'difficulty', 'gradeTags', 'version', 'status']);
  });

  it('adds a new lesson to its grade in ministry order, with its explanation file', () => {
    const newLesson = lesson({ slug: 'g7-24-new', order: 24, title: 'Новий', explanationMd: 'Текст\n' });
    const plan = planContentWrite({ topics: [], tasks: [], lessons: [newLesson] }, existingFrom(bundle));
    const paths = plan.writes.map((write) => write.path);
    expect(paths).toEqual(['lessons/grade7.json', 'lessons/grade7/g7-24-new.md']);
    const grade7 = JSON.parse(plan.writes[0].content) as { slug: string }[];
    expect(grade7.map((entry) => entry.slug)).toEqual(['g7-24-new', 'g7-25-intro']);
    expect(plan.writes[1].content).toBe('Текст\n');
  });

  it('writes a lesson list one entry per line, like the hand-written file', () => {
    const plan = planContentWrite({ topics: [], tasks: [], lessons: [lesson({ title: 'Інша назва' })] }, existingFrom(bundle));
    expect(plan.writes[0].content).toBe(
      '[\n  {"slug": "g7-25-intro", "grade": 7, "order": 25, "kind": "mandatory", "title": "Інша назва", "curriculumRef": "7:25", "coreTaskSlugs": ["g7-quiz-a"], "additionalTaskSlugs": []}\n]\n'
    );
  });

  it('never deletes: what content/ has and the export lacks is only reported', () => {
    const plan = planContentWrite({ topics: [], tasks: [], lessons: [] }, existingFrom(bundle));
    expect(plan.writes).toEqual([]);
    expect(plan.notInExport).toEqual({ topics: ['intro'], tasks: ['g7-quiz-a'], lessons: ['g7-25-intro'] });
  });

  it('creates topics.json when content/ has none yet', () => {
    const plan = planContentWrite({ topics: [topic], tasks: [] }, { topics: null, tasks: new Map(), lessons: new Map(), explanations: new Map() });
    expect(plan.writes).toEqual([
      {
        path: 'topics.json',
        content: '[\n  { "slug": "intro", "title": "Вступ", "order": 1, "gradeTags": [7], "curriculumRef": "7:25" }\n]\n'
      }
    ]);
  });
});

describe('formatJson', () => {
  it('keeps short arrays and objects on one line and breaks long ones', () => {
    const text = formatJson({ stdin: ['5', '3'], hints: ['а'.repeat(60), 'б'.repeat(60)] });
    expect(text).toBe(`{\n  "stdin": ["5", "3"],\n  "hints": [\n    "${'а'.repeat(60)}",\n    "${'б'.repeat(60)}"\n  ]\n}\n`);
  });

  it('round-trips to the same value', () => {
    const value = taskFileContent(task({ cases: [{ stdin: ['1'], label: 'один', checks: [{ kind: 'number_close', value: 1, tol: 0 }] }] }));
    expect(JSON.parse(formatJson(value))).toEqual(value);
  });
});

describe('inlineJson / sameJson', () => {
  it('writes compact one-line JSON with or without brace spacing', () => {
    expect(inlineJson({ a: [1, 2], b: {} })).toBe('{ "a": [1, 2], "b": {} }');
    expect(inlineJson({ a: 1 }, false)).toBe('{"a": 1}');
  });

  it('compares parsed JSON ignoring key order and undefined keys', () => {
    expect(sameJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameJson({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
    expect(sameJson({ a: 1 }, { a: '1' })).toBe(false);
  });
});
