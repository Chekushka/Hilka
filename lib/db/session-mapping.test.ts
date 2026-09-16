import { describe, expect, it } from 'vitest';
import { orderSessionTasks } from './session-mapping';

describe('orderSessionTasks', () => {
  it('restores the order sessions.task_ids defines, not row order', () => {
    const rows = [
      { id: 'b', slug: 'task-b', title: 'B' },
      { id: 'a', slug: 'task-a', title: 'A' }
    ];
    expect(orderSessionTasks(['a', 'b'], rows).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('drops a task id with no matching row', () => {
    const rows = [{ id: 'a', slug: 'task-a', title: 'A' }];
    expect(orderSessionTasks(['a', 'deleted'], rows)).toEqual(rows);
  });

  it('returns an empty list for a session with no tasks', () => {
    expect(orderSessionTasks([], [])).toEqual([]);
  });
});
