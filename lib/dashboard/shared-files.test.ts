import { describe, expect, it } from 'vitest';
import { findSharedFiles } from './shared-files';

function attempt(studentName: string, taskId: string, sourceHash: string | null, passed = true) {
  return { studentName, taskId, taskTitle: taskId === 't1' ? 'Привіт, IDLE' : 'Цикл', passed, sourceHash };
}

describe('findSharedFiles', () => {
  it('groups passing attempts with the same hash on the same task across different students', () => {
    const groups = findSharedFiles([attempt('Олена', 't1', 'aaa'), attempt('Тарас', 't1', 'aaa')]);
    expect(groups).toEqual([{ taskId: 't1', taskTitle: 'Привіт, IDLE', studentNames: ['Олена', 'Тарас'] }]);
  });

  it('does not flag one student resubmitting the same file', () => {
    expect(findSharedFiles([attempt('Олена', 't1', 'aaa'), attempt('Олена', 't1', 'aaa')])).toEqual([]);
  });

  it('lists each student once even with several identical attempts', () => {
    const groups = findSharedFiles([
      attempt('Олена', 't1', 'aaa'),
      attempt('Олена', 't1', 'aaa'),
      attempt('Тарас', 't1', 'aaa')
    ]);
    expect(groups[0].studentNames).toEqual(['Олена', 'Тарас']);
  });

  it('ignores failing attempts, so an untouched starter file is not flagged', () => {
    expect(findSharedFiles([attempt('Олена', 't1', 'aaa', false), attempt('Тарас', 't1', 'aaa', false)])).toEqual([]);
    expect(findSharedFiles([attempt('Олена', 't1', 'aaa', false), attempt('Тарас', 't1', 'aaa')])).toEqual([]);
  });

  it('ignores attempts without a hash (inline tasks)', () => {
    expect(findSharedFiles([attempt('Олена', 't1', null), attempt('Тарас', 't1', null)])).toEqual([]);
  });

  it('does not match the same hash across different tasks', () => {
    expect(findSharedFiles([attempt('Олена', 't1', 'aaa'), attempt('Тарас', 't2', 'aaa')])).toEqual([]);
  });

  it('keeps distinct hashes on one task as separate groups, sorted stably', () => {
    const groups = findSharedFiles([
      attempt('Тарас', 't1', 'bbb'),
      attempt('Олена', 't1', 'aaa'),
      attempt('Андрій', 't1', 'bbb'),
      attempt('Марія', 't1', 'aaa'),
      attempt('Іра', 't1', 'ccc')
    ]);
    expect(groups.map((g) => g.studentNames)).toEqual([
      ['Андрій', 'Тарас'],
      ['Марія', 'Олена']
    ]);
  });
});
