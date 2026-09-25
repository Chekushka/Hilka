import { describe, expect, it } from 'vitest';
import { latestSubmissionFiles, safeFileName } from './submitted-files';

function row(studentName: string, code: string, createdAt: string, taskId = 't1', taskTitle = 'Привіт, IDLE') {
  return { studentName, taskId, taskTitle, code, createdAt };
}

const decode = (data: Uint8Array) => new TextDecoder().decode(data);

describe('latestSubmissionFiles', () => {
  it('keeps only each student\'s latest upload per task', () => {
    const files = latestSubmissionFiles([
      row('Олена', 'first', '2026-01-01T10:00:00.000Z'),
      row('Олена', 'last', '2026-01-01T10:05:00.000Z'),
      row('Олена', 'middle', '2026-01-01T10:02:00.000Z')
    ]);
    expect(files.map((f) => [f.name, decode(f.data)])).toEqual([['Привіт, IDLE/Олена.py', 'last']]);
  });

  it('lays files out as task folder / student file, sorted', () => {
    const files = latestSubmissionFiles([
      row('Тарас', 'a', '2026-01-01T10:00:00.000Z'),
      row('Олена', 'b', '2026-01-01T10:00:00.000Z'),
      row('Олена', 'c', '2026-01-01T10:00:00.000Z', 't2', 'Цикл')
    ]);
    expect(files.map((f) => f.name)).toEqual(['Привіт, IDLE/Олена.py', 'Привіт, IDLE/Тарас.py', 'Цикл/Олена.py']);
  });

  it('never lets two entries collide on the same path', () => {
    const files = latestSubmissionFiles([
      row('Олена', 'a', '2026-01-01T10:00:00.000Z', 't1', 'Задача'),
      row('Олена', 'b', '2026-01-01T10:00:00.000Z', 't2', 'Задача')
    ]);
    expect(files.map((f) => f.name)).toEqual(['Задача/Олена.py', 'Задача/Олена (2).py']);
  });
});

describe('safeFileName', () => {
  it('replaces path separators and reserved characters', () => {
    expect(safeFileName('../А/Б:В*?')).toBe('_А_Б_В__');
  });

  it('never returns an empty name', () => {
    expect(safeFileName('...')).toBe('_');
  });
});
