import { describe, expect, it } from 'vitest';
import { filePrerequisite, isFileDelivery, unsequencedFileTasks, type SequencedTask } from './prerequisite';
import type { TaskType } from './types';

function inline(id: string, topicKey = 'intro', type: TaskType = 'code'): SequencedTask {
  return { id, topicKey, type, fileDelivery: false };
}

function file(id: string, topicKey = 'intro', type: TaskType = 'code'): SequencedTask {
  return { id, topicKey, type, fileDelivery: true };
}

describe('isFileDelivery', () => {
  it('is true only for delivery: file', () => {
    expect(isFileDelivery({ type: 'code', delivery: 'file' })).toBe(true);
    expect(isFileDelivery({ type: 'code', delivery: 'inline' })).toBe(false);
    expect(isFileDelivery({ type: 'code' })).toBe(false);
    expect(isFileDelivery(null)).toBe(false);
    expect(isFileDelivery('file')).toBe(false);
  });
});

describe('filePrerequisite', () => {
  it('finds the nearest earlier in-browser task on the same topic', () => {
    const sequence = [inline('a'), inline('b'), file('f')];
    expect(filePrerequisite(sequence, 'f')?.id).toBe('b');
  });

  it('skips tasks on another topic', () => {
    const sequence = [inline('a'), inline('other', 'loops-for'), file('f')];
    expect(filePrerequisite(sequence, 'f')?.id).toBe('a');
  });

  it('skips tasks where the student writes no code', () => {
    const sequence = [inline('code'), inline('quiz', 'intro', 'quiz'), inline('predict', 'intro', 'predict'), file('f')];
    expect(filePrerequisite(sequence, 'f')?.id).toBe('code');
  });

  it('accepts fix and fill as the in-browser twin', () => {
    expect(filePrerequisite([inline('x', 'intro', 'fix'), file('f')], 'f')?.id).toBe('x');
    expect(filePrerequisite([inline('x', 'intro', 'fill'), file('f')], 'f')?.id).toBe('x');
  });

  it('never counts another file task', () => {
    expect(filePrerequisite([file('earlier'), file('f')], 'f')).toBeNull();
  });

  it('never looks after the file task', () => {
    expect(filePrerequisite([file('f'), inline('later')], 'f')).toBeNull();
  });

  it('is null for a task that is not file-delivered, or not in the sequence', () => {
    const sequence = [inline('a'), inline('b')];
    expect(filePrerequisite(sequence, 'b')).toBeNull();
    expect(filePrerequisite(sequence, 'missing')).toBeNull();
  });
});

describe('unsequencedFileTasks', () => {
  it('lists every file task with no prerequisite, in order', () => {
    const sequence = [file('first'), inline('a'), file('ok'), file('loop', 'loops-for')];
    expect(unsequencedFileTasks(sequence).map((task) => task.id)).toEqual(['first', 'loop']);
  });

  it('is empty for a sequence without file tasks', () => {
    expect(unsequencedFileTasks([inline('a'), inline('b')])).toEqual([]);
  });
});
