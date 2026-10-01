import { describe, expect, it } from 'vitest';
import { suspensionLine } from './suspension-line';

describe('suspensionLine', () => {
  it('takes the innermost frame of the program, not the outer call site', () => {
    const chain = {
      $filename: '<stdin>.py',
      $lineno: 5,
      child: { $filename: '<stdin>.py', $lineno: 2, child: { data: { type: 'Sk.promise' } } }
    };
    expect(suspensionLine(chain)).toBe(2);
  });

  it('skips frames from other files below the program', () => {
    const chain = { $filename: '<stdin>.py', $lineno: 3, child: { $filename: 'src/lib/x.py', $lineno: 40 } };
    expect(suspensionLine(chain)).toBe(3);
  });

  it('is null when no frame belongs to the program', () => {
    expect(suspensionLine({ child: { data: {} } })).toBeNull();
  });
});
