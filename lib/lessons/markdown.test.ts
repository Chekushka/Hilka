import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('splits headings, paragraphs, lists and code blocks', () => {
    const blocks = parseMarkdown(
      [
        '# Цикл for',
        '',
        'Повторює дію',
        'кілька разів.',
        '',
        '- перше',
        '- друге',
        '',
        '1. раз',
        '2. два',
        '',
        '```python',
        'for i in range(4):',
        '    print(i)',
        '```'
      ].join('\n')
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, children: [{ kind: 'text', text: 'Цикл for' }] },
      { kind: 'paragraph', children: [{ kind: 'text', text: 'Повторює дію кілька разів.' }] },
      {
        kind: 'list',
        ordered: false,
        items: [[{ kind: 'text', text: 'перше' }], [{ kind: 'text', text: 'друге' }]]
      },
      { kind: 'list', ordered: true, items: [[{ kind: 'text', text: 'раз' }], [{ kind: 'text', text: 'два' }]] },
      { kind: 'code', lang: 'python', text: 'for i in range(4):\n    print(i)' }
    ]);
  });

  it('keeps indentation and blank lines inside a code block', () => {
    const [block] = parseMarkdown('```\nif x:\n\n    y = 1\n```');
    expect(block).toEqual({ kind: 'code', lang: '', text: 'if x:\n\n    y = 1' });
  });

  it('does not treat markdown inside a code block as markdown', () => {
    const [block] = parseMarkdown('```\n# not a heading\n- not a list\n```');
    expect(block).toEqual({ kind: 'code', lang: '', text: '# not a heading\n- not a list' });
  });

  it('runs an unclosed fence to the end instead of losing the text', () => {
    expect(parseMarkdown('```\nprint(1)')).toEqual([{ kind: 'code', lang: '', text: 'print(1)' }]);
  });

  it('normalizes CRLF', () => {
    expect(parseMarkdown('## A\r\n\r\nb')).toHaveLength(2);
  });

  it('keeps raw HTML as literal text', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', text: '<script>alert(1)</script>' }] }
    ]);
  });
});

describe('parseInline', () => {
  it('parses code, strong and em', () => {
    expect(parseInline('Функція `print` **виводить** *текст*')).toEqual([
      { kind: 'text', text: 'Функція ' },
      { kind: 'code', text: 'print' },
      { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'виводить' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'текст' }] }
    ]);
  });

  it('does not parse markup inside inline code', () => {
    expect(parseInline('`a * b * c`')).toEqual([{ kind: 'code', text: 'a * b * c' }]);
  });

  it('leaves a lone asterisk or backtick as text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ kind: 'text', text: '2 * 3 = 6' }]);
    expect(parseInline('a ` b')).toEqual([{ kind: 'text', text: 'a ` b' }]);
  });
});
