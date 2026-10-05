import { describe, expect, it } from 'vitest';
import { findSimilarCode, MIN_TOKENS, structureKey } from './similar';

const ORIGINAL = `# площа і периметр
a = float(input("Довжина: "))
b = float(input("Ширина: "))
area = a * b
perimeter = 2 * (a + b)
if area > perimeter:
    print("Площа більша")
else:
    print("Периметр більший")
`;

// The same program after the cheap disguise: other names, comments, spacing, a blank line.
const DISGUISED = `x=float(input("Довжина: "))

y = float( input("Ширина: ") )   # моє
s = x*y
p = 2*(x+y)
if s > p:
    print("Площа більша")
else:
    print("Периметр більший")
`;

// Honestly different: the comparison is the other way round.
const DIFFERENT = ORIGINAL.replace('if area > perimeter:', 'if perimeter < area:');

describe('structureKey', () => {
  it('sees through renamed variables, comments and spacing', () => {
    expect(structureKey(DISGUISED)).toBe(structureKey(ORIGINAL));
  });

  it('keeps structure and text: a different program differs', () => {
    expect(structureKey(DIFFERENT)).not.toBe(structureKey(ORIGINAL));
    expect(structureKey(ORIGINAL.replace('Площа більша', 'Більша площа'))).not.toBe(structureKey(ORIGINAL));
  });

  it('keeps indentation: the same lines nested differently differ', () => {
    const flat = 'for i in range(4):\n    turtle.forward(100)\nturtle.right(90)\n'.repeat(3);
    const nested = 'for i in range(4):\n    turtle.forward(100)\n    turtle.right(90)\n'.repeat(3);
    expect(structureKey(flat)).not.toBe(structureKey(nested));
  });

  it('does not compare a program too short to mean anything', () => {
    expect(structureKey('print("Привіт")')).toBeNull();
    expect(MIN_TOKENS).toBeGreaterThan(10);
  });

  it('ignores variable names inside f-string braces, not the text around them', () => {
    expect(structureKey(`${ORIGINAL}print(f"Площа: {area}")\n`)).toBe(structureKey(`${DISGUISED}print(f"Площа: {s}")\n`));
  });
});

describe('findSimilarCode', () => {
  const at = (minute: number) => `2026-10-05T10:${String(minute).padStart(2, '0')}:00.000Z`;
  const submission = (studentName: string, code: string, minute: number, taskId = 't1') => ({
    studentId: studentName,
    studentName,
    taskId,
    taskTitle: 'Площа',
    code,
    createdAt: at(minute)
  });

  it('groups students whose latest passing program is the same', () => {
    const groups = findSimilarCode([
      submission('Олена', ORIGINAL, 1),
      submission('Марко', DISGUISED, 2),
      submission('Ігор', DIFFERENT, 3)
    ]);
    expect(groups).toEqual([
      { taskId: 't1', taskTitle: 'Площа', studentIds: ['Марко', 'Олена'], studentNames: ['Марко', 'Олена'] }
    ]);
  });

  it('reads only each student’s latest program on a task', () => {
    const groups = findSimilarCode([
      submission('Олена', ORIGINAL, 1),
      submission('Марко', ORIGINAL, 2),
      submission('Марко', DIFFERENT, 3)
    ]);
    expect(groups).toEqual([]);
  });

  it('tells apart two students who share a name, by id', () => {
    const groups = findSimilarCode([
      { ...submission('Олена', ORIGINAL, 1), studentId: 'a1' },
      { ...submission('Олена', ORIGINAL, 2), studentId: 'b2' }
    ]);
    expect(groups).toEqual([{ taskId: 't1', taskTitle: 'Площа', studentIds: ['a1', 'b2'], studentNames: ['Олена', 'Олена'] }]);
  });

  it('never groups across tasks', () => {
    expect(findSimilarCode([submission('Олена', ORIGINAL, 1, 't1'), submission('Марко', ORIGINAL, 2, 't2')])).toEqual([]);
  });
});
