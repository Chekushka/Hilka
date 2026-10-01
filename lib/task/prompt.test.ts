import { describe, expect, it } from 'vitest';
import { parsePrompt, promptPlainText } from './prompt';

const HOUSE = "Виведи будиночок рівно так, як на зразку:\n\n```\n  /\\\n /  \\\n/____\\\n|    |\n|____|\n```";

describe('parsePrompt', () => {
  it('leaves a prompt without fences as one text part, untouched', () => {
    expect(parsePrompt('Порахуй a * b.\nВиведи результат.')).toEqual([
      { kind: 'text', text: 'Порахуй a * b.\nВиведи результат.' }
    ]);
  });

  it('keeps every space of a fenced sample, leading ones included', () => {
    expect(parsePrompt(HOUSE)).toEqual([
      { kind: 'text', text: 'Виведи будиночок рівно так, як на зразку:' },
      { kind: 'sample', text: '  /\\\n /  \\\n/____\\\n|    |\n|____|' }
    ]);
  });

  it('allows text after a sample, and a language tag on the fence', () => {
    expect(parsePrompt('До:\n```text\n1 2\n```\nПісля.')).toEqual([
      { kind: 'text', text: 'До:' },
      { kind: 'sample', text: '1 2' },
      { kind: 'text', text: 'Після.' }
    ]);
  });

  it('treats an unclosed fence as literal text', () => {
    expect(parsePrompt('Ось:\n```\nнезакрито')).toEqual([{ kind: 'text', text: 'Ось:\n```\nнезакрито' }]);
  });
});

describe('promptPlainText', () => {
  it('drops only the fence lines', () => {
    expect(promptPlainText(HOUSE)).toBe('Виведи будиночок рівно так, як на зразку:\n\n  /\\\n /  \\\n/____\\\n|    |\n|____|');
  });
});
