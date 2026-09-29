import { describe, expect, it } from 'vitest';
import { describeSubmittedAnswer } from './submitted-answer';

describe('describeSubmittedAnswer', () => {
  it('reads the checked code of code, fix and fill tasks', () => {
    for (const type of ['code', 'fix', 'fill'] as const) {
      const payload = { type } as Parameters<typeof describeSubmittedAnswer>[0];
      expect(describeSubmittedAnswer(payload, { code: 'print(1)' })).toEqual({ kind: 'code', code: 'print(1)' });
    }
  });

  it('marks the ticked quiz options by their text', () => {
    const view = describeSubmittedAnswer(
      { type: 'quiz', prompt: '', options: ['a', 'b', 'c'], multiple: true },
      { choiceIndices: [0, 2] }
    );
    expect(view).toEqual({
      kind: 'choices',
      options: [
        { text: 'a', chosen: true },
        { text: 'b', chosen: false },
        { text: 'c', chosen: true }
      ],
      missing: 0
    });
  });

  it('counts a choice index that no longer names an option as missing', () => {
    const view = describeSubmittedAnswer(
      { type: 'quiz', prompt: '', options: ['a'], multiple: false },
      { choiceIndices: [3] }
    );
    expect(view).toMatchObject({ kind: 'choices', missing: 1 });
  });

  it('reads predict in both answer modes', () => {
    expect(
      describeSubmittedAnswer({ type: 'predict', prompt: '', code: '', answerMode: 'text' }, { text: '8' })
    ).toEqual({ kind: 'text', text: '8' });
    expect(
      describeSubmittedAnswer(
        { type: 'predict', prompt: '', code: '', answerMode: 'choice', options: ['7', '8'] },
        { choiceIndices: [1] }
      )
    ).toMatchObject({ kind: 'choices', options: [{ text: '7', chosen: false }, { text: '8', chosen: true }] });
  });

  it('rebuilds a parsons answer in the student\'s order and indents, distractors marked', () => {
    const view = describeSubmittedAnswer(
      {
        type: 'parsons',
        prompt: '',
        indentMode: 'chosen',
        lines: [
          { text: 'for i in range(3):', indent: 0 },
          { text: 'print(i)', indent: 1 }
        ],
        distractors: ['print(i']
      },
      {
        orderedLines: [
          { index: 1, indent: 0 },
          { index: 2, indent: 1 },
          { index: 0, indent: 0 },
          { index: 9, indent: 0 }
        ]
      }
    );
    expect(view).toEqual({
      kind: 'lines',
      lines: [
        { text: 'print(i)', indent: 0, distractor: false },
        { text: 'print(i', indent: 1, distractor: true },
        { text: 'for i in range(3):', indent: 0, distractor: false }
      ],
      missing: 1
    });
  });

  it('says unreadable rather than guessing', () => {
    expect(describeSubmittedAnswer({ type: 'quiz', prompt: '', options: [], multiple: false }, null)).toEqual({
      kind: 'unreadable'
    });
    expect(
      describeSubmittedAnswer({ type: 'quiz', prompt: '', options: [], multiple: false }, { text: 'x' })
    ).toEqual({ kind: 'unreadable' });
  });
});
