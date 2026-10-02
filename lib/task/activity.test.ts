import { describe, expect, it } from 'vitest';
import { NO_ACTIVITY, parseActivity, recordChange } from './activity';

describe('recordChange', () => {
  it('counts edits and keeps only the largest paste', () => {
    let activity = NO_ACTIVITY;
    activity = recordChange(activity, { pasted: null });
    activity = recordChange(activity, { pasted: 'a = 1\nb = 2\nprint(a + b)\n' });
    activity = recordChange(activity, { pasted: 'x' });
    activity = recordChange(activity, { pasted: null });
    expect(activity).toEqual({ edits: 2, largestPasteChars: 25, largestPasteLines: 3 });
  });

  it('does not count a trailing newline as a line', () => {
    expect(recordChange(NO_ACTIVITY, { pasted: 'print(1)\n' }).largestPasteLines).toBe(1);
  });
});

describe('parseActivity', () => {
  it('accepts three non-negative integer counts', () => {
    expect(parseActivity({ edits: 3, largestPasteChars: 0, largestPasteLines: 0 })).toEqual({
      edits: 3,
      largestPasteChars: 0,
      largestPasteLines: 0
    });
  });

  it('rejects anything else', () => {
    expect(parseActivity(null)).toBeNull();
    expect(parseActivity({ edits: -1, largestPasteChars: 0, largestPasteLines: 0 })).toBeNull();
    expect(parseActivity({ edits: 1.5, largestPasteChars: 0, largestPasteLines: 0 })).toBeNull();
    expect(parseActivity({ edits: 1, largestPasteChars: '9', largestPasteLines: 0 })).toBeNull();
  });
});
