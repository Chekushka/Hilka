import { describe, expect, it } from 'vitest';
import type { RunOptions, RunResult } from '@/lib/runner';
import { recheckAnswer } from './recheck';
import type { CodeTask, QuizTask } from './types';

/** A stand-in for the engine: "prints" each line of `print(...)` literally, and adds what stdin it was given. */
async function fakeRun(code: string, options: RunOptions): Promise<RunResult> {
  const printed = [...code.matchAll(/print\((\d+)\)/g)].map((match) => match[1]);
  const sum = (options.stdin ?? []).reduce((total, value) => total + Number(value), 0);
  const stdout = code.includes('crash') ? '' : [...printed, ...(code.includes('sum') ? [String(sum)] : [])].join('\n') + '\n';
  return {
    stdout,
    error: code.includes('crash') ? { type: 'NameError', message: 'crash', line: 1, col: null } : null,
    drawing: [],
    dots: [],
    grid: null,
    timedOut: false,
    inputsConsumed: 0,
    elapsedMs: 1,
    vars: {},
    exprResults: {}
  } as RunResult;
}

const codeTask: CodeTask = {
  id: 't',
  slug: 't',
  topicId: 'topic',
  type: 'code',
  title: 'Сума',
  payload: { type: 'code', surface: 'console', prompt: '', starter: '' },
  checks: [{ kind: 'last_line_equals', value: '5' }],
  cases: [
    { stdin: ['2', '3'] },
    { stdin: ['1', '4'], hidden: true }
  ],
  hints: [],
  reference: { code: 'sum', computedAt: '', artifacts: {} },
  difficulty: 1,
  gradeTags: [7],
  version: 1,
  status: 'published'
} as unknown as CodeTask;

describe('recheckAnswer', () => {
  it('passes stored code that really passes every case', async () => {
    expect(await recheckAnswer(codeTask, { code: 'sum' }, fakeRun)).toBe('passes');
  });

  it('fails stored code that was posted as passed but does not pass', async () => {
    expect(await recheckAnswer(codeTask, { code: 'print(5)\nprint(6)' }, fakeRun)).toBe('fails');
    expect(await recheckAnswer(codeTask, { code: 'crash' }, fakeRun)).toBe('fails');
  });

  it('calls an answer with no code unreadable rather than guessing', async () => {
    expect(await recheckAnswer(codeTask, {}, fakeRun)).toBe('unreadable');
    expect(await recheckAnswer(codeTask, null, fakeRun)).toBe('unreadable');
  });

  it('evaluates a quiz answer without running anything', async () => {
    const quiz = {
      id: 'q',
      slug: 'q',
      topicId: 'topic',
      type: 'quiz',
      title: 'Квіз',
      payload: { type: 'quiz', prompt: '', options: ['a', 'b'], multiple: false },
      checks: [{ kind: 'choice_equals', indices: [1] }],
      hints: [],
      difficulty: 1,
      gradeTags: [7],
      version: 1,
      status: 'published'
    } as unknown as QuizTask;
    const never = async () => {
      throw new Error('a quiz must not run Python');
    };
    expect(await recheckAnswer(quiz, { choiceIndices: [1] }, never)).toBe('passes');
    expect(await recheckAnswer(quiz, { choiceIndices: [0] }, never)).toBe('fails');
  });
});
