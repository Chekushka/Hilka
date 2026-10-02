import { describe, expect, it } from 'vitest';
import type { TaskPayload } from '@/lib/task/types';
import { hasFacts, homeworkFacts, pastedWhole, programsOf, taughtForHomework, type FactAttempt } from './facts';

describe('pastedWhole', () => {
  it('reports a long paste with few edits, never a short paste or a worked-on one', () => {
    expect(pastedWhole({ edits: 2, largestPasteChars: 200, largestPasteLines: 9 })).toBe(true);
    expect(pastedWhole({ edits: 2, largestPasteChars: 20, largestPasteLines: 2 })).toBe(false);
    expect(pastedWhole({ edits: 40, largestPasteChars: 200, largestPasteLines: 9 })).toBe(false);
    expect(pastedWhole(null)).toBe(false);
  });
});

describe('programsOf', () => {
  it('takes the reference and what the task shows, with fill gaps emptied', () => {
    const fill = { type: 'fill', prompt: '', template: 'for i in range({{0}}):\n    print({{1}})' } as unknown as TaskPayload;
    expect(programsOf(fill, 'for i in range(3):\n    print(i)')).toEqual([
      'for i in range(3):\n    print(i)',
      'for i in range():\n    print()'
    ]);
  });
});

describe('taughtForHomework', () => {
  const content = [
    { id: 'early', gradeTags: [7], topicOrder: 1, programs: ['print(1)'] },
    { id: 'hw', gradeTags: [7], topicOrder: 5, programs: ['for i in range(3):\n    print(i)'] },
    { id: 'later', gradeTags: [7], topicOrder: 9, programs: ['print(sum([1, 2]))'] },
    { id: 'other-grade', gradeTags: [9], topicOrder: 2, programs: ['def f():\n    pass'] }
  ];

  it('counts what this grade used up to the homework’s latest topic, and nothing beyond', () => {
    const taught = taughtForHomework(['hw'], content);
    expect(taught).toContain('call:print');
    expect(taught).toContain('kw:for');
    expect(taught).not.toContain('call:sum');
    expect(taught).not.toContain('kw:def');
  });
});

describe('homeworkFacts', () => {
  const program = `a = float(input("Довжина: "))
b = float(input("Ширина: "))
area = a * b
perimeter = 2 * (a + b)
if area > perimeter:
    print("Площа більша")
else:
    print("Периметр більший")
`;
  const attempt = (studentName: string, extra: Partial<FactAttempt>): FactAttempt => ({
    studentName,
    taskId: 't1',
    taskTitle: 'Площа',
    passed: true,
    code: program,
    activity: null,
    createdAt: '2026-10-05T10:00:00.000Z',
    ...extra
  });
  const taught = new Set(['call:float', 'call:input', 'call:print', 'kw:if', 'kw:else']);

  it('gathers each student’s facts and the similar groups', () => {
    const { byStudent, similarGroups } = homeworkFacts(
      ['Олена', 'Марко', 'Ігор'],
      [
        attempt('Олена', { activity: { edits: 1, largestPasteChars: 300, largestPasteLines: 8 } }),
        attempt('Марко', { code: program.replace(/area/g, 's').replace(/perimeter/g, 'p') }),
        attempt('Ігор', { code: 'n = int(input())\nprint(sum(range(n)))' })
      ],
      taught,
      new Set()
    );
    expect(similarGroups).toEqual([{ taskId: 't1', taskTitle: 'Площа', studentNames: ['Марко', 'Олена'] }]);
    expect(byStudent.get('Олена')).toEqual({
      pasted: [{ taskTitle: 'Площа', lines: 8, edits: 1 }],
      similar: [{ taskTitle: 'Площа', others: ['Марко'] }],
      untaught: []
    });
    expect(byStudent.get('Ігор')!.untaught).toEqual([{ taskTitle: 'Площа', constructs: ['int()', 'range()', 'sum()'] }]);
    expect(hasFacts(byStudent.get('Ігор')!)).toBe(true);
  });

  it('never compares fill programs, which share their template by design', () => {
    const { similarGroups } = homeworkFacts(['Олена', 'Марко'], [attempt('Олена', {}), attempt('Марко', {})], taught, new Set(['t1']));
    expect(similarGroups).toEqual([]);
  });

  it('reports nothing for a student with nothing to report', () => {
    const { byStudent } = homeworkFacts(['Соломія'], [], taught, new Set());
    expect(hasFacts(byStudent.get('Соломія')!)).toBe(false);
  });
});
