import { describe, expect, it } from 'vitest';
import {
  STUCK_RULES,
  countStates,
  sortForClassTable,
  tallyTasks,
  summarizeStudents,
  taskTotalsFor,
  type SessionContext,
  type StudentAttempt
} from './class-status';

/** A test student's id is their name — enough to tell them apart here. */
const roster = (...names: string[]) => names.map((name) => ({ id: name, name }));

const tasks = [
  { id: 't1', slug: 'square', title: 'Квадрат', difficulty: 1 },
  { id: 't2', slug: 'triangle', title: 'Трикутник', difficulty: 2 }
];

const NOW = Date.parse('2026-09-29T11:00:00Z');
const practice: SessionContext = { mode: 'practice', open: true, now: NOW };
const graded: SessionContext = { mode: 'graded', open: true, now: NOW };

function minutesBefore(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function attempt(
  studentName: string,
  taskId: string,
  passed: boolean,
  minutesAgo: number,
  extra: Partial<StudentAttempt> = {}
): StudentAttempt {
  return { studentId: studentName, taskId, passed, hintsUsed: 0, durationMs: 60_000, createdAt: minutesBefore(minutesAgo), ...extra };
}

function stateOf(attempts: StudentAttempt[], context = practice) {
  return summarizeStudents(roster('Олена'), tasks, attempts, context)[0].state;
}

describe('summarizeStudents — state', () => {
  it('is not_started with no attempts', () => {
    expect(stateOf([])).toBe('not_started');
  });

  it('is working after a pass with tasks left', () => {
    expect(stateOf([attempt('Олена', 't1', true, 1)])).toBe('working');
  });

  it('is working right after a failed Check', () => {
    expect(stateOf([attempt('Олена', 't1', false, 1)])).toBe('working');
  });

  it('is finished once every task is passed', () => {
    expect(stateOf([attempt('Олена', 't1', true, 5), attempt('Олена', 't2', true, 1)])).toBe('finished');
  });

  it(`is stuck after ${STUCK_RULES.failedChecks} failed Checks on one task`, () => {
    const fails = Array.from({ length: STUCK_RULES.failedChecks }, (_, i) => attempt('Олена', 't1', false, 3 - i));
    expect(stateOf(fails)).toBe('stuck');
    expect(stateOf(fails.slice(1))).toBe('working');
  });

  it('stops being stuck once the task is passed', () => {
    const fails = Array.from({ length: STUCK_RULES.failedChecks }, () => attempt('Олена', 't1', false, 4));
    expect(stateOf([...fails, attempt('Олена', 't1', true, 1)])).toBe('working');
  });

  it(`is stuck when the latest Check failed ${STUCK_RULES.idleMinutes} minutes ago and nothing since`, () => {
    expect(stateOf([attempt('Олена', 't1', false, STUCK_RULES.idleMinutes)])).toBe('stuck');
    expect(stateOf([attempt('Олена', 't1', false, STUCK_RULES.idleMinutes - 1)])).toBe('working');
  });

  it('does not count idleness after a pass', () => {
    expect(stateOf([attempt('Олена', 't1', true, 30)])).toBe('working');
  });

  it('does not count idleness in a closed session', () => {
    expect(stateOf([attempt('Олена', 't1', false, 30)], { ...practice, open: false })).toBe('working');
  });

  it('never marks anyone stuck in a graded session, and a checked task counts as done there', () => {
    expect(stateOf([attempt('Олена', 't1', false, 30)], graded)).toBe('working');
    expect(stateOf([attempt('Олена', 't1', false, 5), attempt('Олена', 't2', true, 1)], graded)).toBe('finished');
  });
});

describe('summarizeStudents — totals', () => {
  it('counts done tasks, attempts, and where the student is now', () => {
    const [row] = summarizeStudents(roster('Олена'),
      tasks,
      [attempt('Олена', 't1', false, 9), attempt('Олена', 't1', true, 7), attempt('Олена', 't2', false, 2)],
      practice
    );
    expect(row.tasksDone).toBe(1);
    expect(row.tasksTotal).toBe(2);
    expect(row.attempts).toBe(3);
    expect(row.currentTaskId).toBe('t2');
    expect(row.lastActivityAt).toBe(minutesBefore(2));
    expect(row.cells.map((cell) => cell.status)).toEqual(['passed', 'stuck']);
  });

  it('takes hints and time per task from its latest counts, summed over tasks', () => {
    const [row] = summarizeStudents(roster('Олена'),
      tasks,
      [
        attempt('Олена', 't1', false, 9, { hintsUsed: 1, durationMs: 30_000 }),
        attempt('Олена', 't1', true, 7, { hintsUsed: 2, durationMs: 90_000 }),
        attempt('Олена', 't2', false, 2, { hintsUsed: 0, durationMs: null })
      ],
      practice
    );
    expect(row.hints).toBe(2);
    expect(row.timeSpentMs).toBe(90_000);
    expect(taskTotalsFor(
      [attempt('Олена', 't1', false, 9, { hintsUsed: 1, durationMs: 30_000 })],
      't1'
    )).toEqual({ hints: 1, timeMs: 30_000 });
  });

  it('ignores attempts on tasks no longer in the session and names off the roster', () => {
    const rows = summarizeStudents(roster('Олена'),
      tasks,
      [attempt('Олена', 'gone', false, 1), attempt('Петро', 't1', true, 1)],
      practice
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attempts).toBe(0);
    expect(rows[0].state).toBe('not_started');
  });
});

describe('sortForClassTable and countStates', () => {
  it('puts stuck first, finished last, alphabetical inside a state', () => {
    const rows = summarizeStudents(roster('Яна', 'Богдан', 'Анна', 'Віра', 'Гліб'),
      tasks,
      [
        attempt('Яна', 't1', false, 10),
        attempt('Богдан', 't1', true, 1),
        attempt('Віра', 't1', true, 3),
        attempt('Віра', 't2', true, 1),
        attempt('Гліб', 't1', false, 20)
      ],
      practice
    );
    expect(sortForClassTable(rows).map((row) => [row.studentName, row.state])).toEqual([
      ['Гліб', 'stuck'],
      ['Яна', 'stuck'],
      ['Богдан', 'working'],
      ['Анна', 'not_started'],
      ['Віра', 'finished']
    ]);
    expect(countStates(rows)).toEqual({ stuck: 2, working: 1, not_started: 1, finished: 1 });
  });
});

describe('tallyTasks', () => {
  it('counts passed, trying and not started per task', () => {
    const rows = summarizeStudents(roster('Анна', 'Богдан', 'Віра'),
      tasks,
      [attempt('Анна', 't1', true, 1), attempt('Богдан', 't1', false, 1), attempt('Богдан', 't2', true, 1)],
      practice
    );
    expect(tallyTasks(rows, tasks.length)).toEqual([
      { passed: 1, trying: 1, notStarted: 1 },
      { passed: 1, trying: 0, notStarted: 2 }
    ]);
  });
});

describe('summarizeStudents in homework', () => {
  const tasks = [
    { id: 'a', slug: 'a', title: 'A', difficulty: 1 },
    { id: 'b', slug: 'b', title: 'B', difficulty: 1 }
  ];
  const at = (taskId: string, passed: boolean, minute: number) => ({
    studentId: 'Олена', studentName: 'Олена',
    taskId,
    passed,
    hintsUsed: 0,
    durationMs: 1000,
    createdAt: `2026-10-05T10:${String(minute).padStart(2, '0')}:00.000Z`
  });
  const context = { mode: 'graded' as const, kind: 'homework' as const, open: true, now: Date.parse('2026-10-05T12:00:00Z') };

  it('counts a failed task as done only once its fixes run out', () => {
    const [withFixes] = summarizeStudents(roster('Олена'), tasks, [at('a', true, 1), at('b', false, 2)], context);
    expect(withFixes.tasksDone).toBe(1);
    expect(withFixes.state).toBe('working');

    const [outOfFixes] = summarizeStudents(roster('Олена'),
      tasks,
      [at('a', true, 1), at('b', false, 2), at('b', false, 3), at('b', false, 4)],
      context
    );
    expect(outOfFixes.tasksDone).toBe(2);
    expect(outOfFixes.state).toBe('finished');
  });
});

describe('summarizeStudents with a pool', () => {
  const tasks = [
    { id: 'a', slug: 'a', title: 'A', difficulty: 1 },
    { id: 'b', slug: 'b', title: 'B', difficulty: 1 },
    { id: 'c', slug: 'c', title: 'C', difficulty: 1 }
  ];
  const passed = (taskId: string) => ({
    studentId: 'Олена', studentName: 'Олена',
    taskId,
    passed: true,
    hintsUsed: 0,
    durationMs: 1000,
    createdAt: '2026-10-05T10:00:00.000Z'
  });
  const context = {
    mode: 'graded' as const,
    open: true,
    now: Date.parse('2026-10-05T12:00:00Z'),
    assignedTo: () => new Set(['a', 'c'])
  };

  it('counts only the student’s own tasks and marks the rest as not assigned', () => {
    const [row] = summarizeStudents(roster('Олена'), tasks, [passed('a'), passed('c')], context);
    expect(row.tasksTotal).toBe(2);
    expect(row.tasksDone).toBe(2);
    expect(row.state).toBe('finished');
    expect(row.cells.map((cell) => cell.status)).toEqual(['passed', 'not_assigned', 'passed']);
  });

  it('leaves a task nobody was given out of the class’s tally', () => {
    const rows = summarizeStudents(roster('Олена'), tasks, [], context);
    expect(tallyTasks(rows, 3)[1]).toEqual({ passed: 0, trying: 0, notStarted: 0 });
    expect(tallyTasks(rows, 3)[0]).toEqual({ passed: 0, trying: 0, notStarted: 1 });
  });
});
