import { describe, expect, it } from 'vitest';
import { parseGuess } from './markdown';
import { parseInline } from './markdown';
import {
  cardKind,
  checkGuessRuns,
  guessShapeProblems,
  hasGuessCards,
  optionOrder,
  parseGuessRuns,
  rememberLines,
  splitTerm,
  theoryCards,
  theoryGuesses
} from './theory';

const GUESS = ['```guess', 'x = 5', 'x = x + 2', 'print(x)', '--', '5', '-- *', '7', '-- чому', '`x + 2` бере старе значення.', '```'].join(
  '\n'
);

describe('parseGuess', () => {
  it('reads the code, the options, the marked answer and why', () => {
    expect(parseGuess(GUESS.split('\n').slice(1, -1))).toEqual({
      code: 'x = 5\nx = x + 2\nprint(x)',
      options: ['5', '7'],
      answer: 1,
      why: [
        { kind: 'code', text: 'x + 2' },
        { kind: 'text', text: ' бере старе значення.' }
      ],
      problems: []
    });
  });

  it('keeps an option of several lines, and the indentation of the code', () => {
    const guess = parseGuess(['for i in range(2):', '    print(i)', '', '-- *', '0', '1', '', '--', '1', '2']);
    expect(guess.code).toBe('for i in range(2):\n    print(i)');
    expect(guess.options).toEqual(['0\n1', '1\n2']);
    expect(guess.answer).toBe(0);
    expect(guess.why).toBeNull();
  });

  it('names every shape problem', () => {
    expect(parseGuess(['--', '1']).problems).toEqual(['noCode', 'tooFewOptions', 'noAnswer']);
    expect(parseGuess(['print(1)', '-- *', '1', '-- *', '1']).problems).toEqual(['severalAnswers', 'duplicateOptions']);
    expect(parseGuess(['print(1)', '-- *', '1', '--', '']).problems).toEqual(['emptyOption']);
    expect(parseGuess(['x = input()', 'print(x)', '-- *', 'a', '--', 'b']).problems).toEqual(['readsInput']);
  });
});

describe('theoryCards', () => {
  it('splits on --- and drops empty cards', () => {
    const cards = theoryCards('Перша\n\n---\n\n---\nДруга\n\n```python\nx = 1\n---\n```');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', text: 'Перша' }] }]);
    // A --- inside a code fence is code, not a break.
    expect(cards[1][1]).toEqual({ kind: 'code', lang: 'python', text: 'x = 1\n---' });
  });

  it('keeps an explanation without breaks as one card', () => {
    expect(theoryCards('Один\n\nДва')).toHaveLength(1);
  });
});

describe('guesses and remember lines', () => {
  const md = `Вступ\n\n---\n\n${GUESS}\n\n---\n\n\`\`\`remember\n\`=\` кладе значення в змінну.\n\nЗмінну можна перезаписати.\n\`\`\``;

  it('finds them in reading order', () => {
    expect(theoryGuesses(md)).toHaveLength(1);
    expect(hasGuessCards(md)).toBe(true);
    expect(hasGuessCards('Лише текст')).toBe(false);
    expect(rememberLines(md)).toEqual([
      [
        { kind: 'code', text: '=' },
        { kind: 'text', text: ' кладе значення в змінну.' }
      ],
      [{ kind: 'text', text: 'Змінну можна перезаписати.' }]
    ]);
  });

  it('a malformed guess earns nothing and is reported by number', () => {
    const broken = `${GUESS}\n\n\`\`\`guess\nprint(1)\n--\n1\n--\n2\n\`\`\``;
    expect(guessShapeProblems(broken)).toEqual([{ guess: 2, problem: 'noAnswer' }]);
    expect(hasGuessCards('```guess\nprint(1)\n--\n1\n```')).toBe(false);
  });
});

describe('checkGuessRuns', () => {
  const code = 'x = 5\nx = x + 2\nprint(x)';

  it('accepts the marked option when it is what the code printed, ignoring spaces at line ends', () => {
    expect(checkGuessRuns(GUESS, [{ code, stdout: '7  \n', failed: false }])).toEqual([]);
  });

  it('refuses a guess nobody ran, one that failed, a wrong mark, and two options that both match', () => {
    expect(checkGuessRuns(GUESS, [])).toEqual([{ guess: 1, problem: 'notRun' }]);
    expect(checkGuessRuns(GUESS, [{ code, stdout: '', failed: true }])).toEqual([{ guess: 1, problem: 'runFailed' }]);
    expect(checkGuessRuns(GUESS, [{ code, stdout: '5\n', failed: false }])).toEqual([
      { guess: 1, problem: 'answerWrong', actual: '5' }
    ]);
    const twice = '```guess\nprint(7)\n-- *\n7\n--\n  7\n```';
    expect(checkGuessRuns(twice, [{ code: 'print(7)', stdout: '7\n', failed: false }])).toEqual([
      { guess: 1, problem: 'ambiguous', actual: '7' }
    ]);
  });

  it('takes only well-shaped runs from a request body', () => {
    expect(parseGuessRuns([{ code: 'a', stdout: 'b', failed: false }, { code: 1 }, null])).toEqual([
      { code: 'a', stdout: 'b', failed: false }
    ]);
    expect(parseGuessRuns('nope')).toEqual([]);
  });
});

describe('optionOrder', () => {
  it('is a permutation, the same every time for the same code', () => {
    const [guess] = theoryGuesses(GUESS);
    const order = optionOrder(guess);
    expect([...order].sort()).toEqual([0, 1]);
    expect(optionOrder(guess)).toEqual(order);
  });
});

describe('content/lessons', () => {
  // Whether each marked answer is really what its code prints needs Python:
  // tests/references/lessons.spec.ts runs them. This only holds the shape.
  it('every guess block in the seed lessons is well formed', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const root = path.join(process.cwd(), 'content', 'lessons');
    const problems = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((dir) =>
        readdirSync(path.join(root, dir.name))
          .filter((file) => file.endsWith('.md'))
          .flatMap((file) =>
            guessShapeProblems(readFileSync(path.join(root, dir.name, file), 'utf8')).map(
              ({ guess, problem }) => `${file}: guess ${guess}: ${problem}`
            )
          )
      );
    expect(problems).toEqual([]);
  });
});

describe('cardKind', () => {
  it('names a card by its most important block', () => {
    const [idea, guess, rule] = theoryCards(`Текст\n\n---\n\n${GUESS}\n\n\`\`\`remember\nПравило\n\`\`\`\n\n---\n\n\`\`\`remember\nПравило\n\`\`\``);
    expect([cardKind(idea), cardKind(guess), cardKind(rule)]).toEqual(['idea', 'guess', 'remember']);
  });
});

describe('splitTerm', () => {
  it('splits "`code` — meaning" at the em dash', () => {
    expect(splitTerm(parseInline('`//` — ділення націло'))).toEqual({
      term: [{ kind: 'code', text: '//' }],
      meaning: [{ kind: 'text', text: 'ділення націло' }]
    });
    expect(splitTerm(parseInline('`right(кут)` і `left(кут)` — поворот у градусах'))?.term).toEqual([
      { kind: 'code', text: 'right(кут)' },
      { kind: 'text', text: ' і ' },
      { kind: 'code', text: 'left(кут)' }
    ]);
  });

  it('leaves alone a line with no code before the dash, a long term, or no dash', () => {
    expect(splitTerm(parseInline('Синтаксичні — Python не розуміє запис'))).toBeNull();
    expect(splitTerm(parseInline('`a` і ще дуже довгий опис перед тире, який не є терміном — так'))).toBeNull();
    expect(splitTerm(parseInline('`print()` виводить текст'))).toBeNull();
  });
});
