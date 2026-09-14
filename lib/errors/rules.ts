/**
 * The rule base. Ordered: the first rule that matches wins.
 *
 * Every message here was written against Skulpt's actual wording, recorded by
 * running the mistakes themselves — Skulpt's text is not CPython's, so a rule
 * written from memory of CPython would never fire. The Ukrainian is data, not
 * interface copy, which is why it lives here rather than in messages/uk.json.
 *
 * Tone: say what happened and what to do next. Do not apologize, do not blame,
 * never use the word "помилка" as a heading.
 */
import {
  indentedWithoutReason,
  lineAt,
  missingColon,
  previousCodeLine,
  shouldBeIndented,
  unclosedDelimiter
} from './source';
import type { Rule } from './types';

function named(message: string): string | null {
  return /name '(.+?)' is not defined/.exec(message)?.[1] ?? null;
}

export const RULES: Rule[] = [
  // Rule #1. The single most common mistake of grade 8: input() returns text,
  // and the first project of the year is arithmetic on it. If this one reaches
  // a student as a traceback, half the class is lost in week one.
  {
    id: 'input-arithmetic',
    type: 'TypeError',
    matches: (error, { code }) =>
      /cannot concatenate 'str' and '(int|float)' objects/.test(error.message) &&
      /\binput\s*\(/.test(code),
    build: () => ({
      title: 'Тут текст і число разом',
      explanation:
        'input() завжди дає текст, навіть коли ти ввів число. Текст і число не додаються.',
      hint: 'Оберни введення у перетворення: int(input()) для цілого числа або float(input()) для дробового.'
    })
  },
  // A program that reads more values than the task supplies. Without this rule
  // the student sees the generic fallback for something with a precise cause:
  // input() raises before any arithmetic on its result can fail.
  {
    id: 'input-without-value',
    type: 'EOFError',
    matches: () => true,
    build: () => ({
      title: 'Програма чекає на введення',
      explanation: 'Виклик input() попросив значення, але отримати його не було звідки.',
      hint: 'Перевір, скільки разів ти читаєш input() — можливо, один виклик зайвий.'
    })
  },
  {
    id: 'concatenate-types',
    type: 'TypeError',
    matches: (error) => /cannot concatenate '(.+?)' and '(.+?)' objects/.test(error.message),
    build: (error) => {
      const match = /cannot concatenate '(.+?)' and '(.+?)' objects/.exec(error.message);
      return {
        title: 'Різні типи не складаються',
        explanation: `Python не може додати ${describeType(match?.[1])} і ${describeType(match?.[2])}.`,
        hint: 'Щоб показати їх разом, перетвори число на текст: str(число). Щоб порахувати — перетвори текст на число.'
      };
    }
  },
  {
    id: 'name-not-defined',
    type: 'NameError',
    matches: (error) => named(error.message) !== null,
    build: (error) => ({
      title: `Python не знає, що таке ${named(error.message)}`,
      explanation:
        'Ця назва ще ніде не з’явилася: або змінну не створено вище, або в назві є одруківка.',
      hint: 'Перевір написання — великі й малі літери теж мають значення.'
    })
  },
  // Skulpt says "bad input" for every one of these, so the line itself decides.
  {
    id: 'syntax-missing-colon',
    type: 'SyntaxError',
    matches: (error, { code }) =>
      missingColon(lineAt(code, error.line)) || missingColon(previousCodeLine(code, error.line)),
    build: () => ({
      title: 'Бракує двокрапки',
      explanation: 'Рядки з if, for, while і def закінчуються двокрапкою.',
      hint: 'Постав : у кінці рядка, а наступний рядок зсунь вправо.'
    })
  },
  {
    id: 'syntax-unclosed',
    type: 'SyntaxError',
    matches: (_error, { code }) => unclosedDelimiter(code) !== null,
    build: (_error, { code }) => {
      const kind = unclosedDelimiter(code);
      return {
        title: kind === 'quote' ? 'Не закриті лапки' : 'Не закрита дужка',
        explanation:
          kind === 'quote'
            ? 'Текст починається і закінчується лапками. Одні з них загубилися.'
            : 'Кожна відкрита дужка має бути закрита.',
        hint: 'Порахуй їх зліва направо — кожній відкритій має відповідати закрита.'
      };
    }
  },
  {
    id: 'syntax-missing-indent',
    type: 'SyntaxError',
    matches: (error, { code }) => shouldBeIndented(code, error.line),
    build: () => ({
      title: 'Рядок треба зсунути вправо',
      explanation:
        'Після двокрапки йде блок — усе, що виконується всередині. Python розуміє його за відступом.',
      hint: 'Додай на початку рядка чотири пробіли.'
    })
  },
  {
    id: 'syntax-unexpected-indent',
    type: 'SyntaxError',
    matches: (error, { code }) => indentedWithoutReason(code, error.line),
    build: () => ({
      title: 'Зайвий відступ',
      explanation: 'Цей рядок зсунутий вправо, але вище немає рядка з двокрапкою, до якого він належить.',
      hint: 'Прибери пробіли на початку рядка.'
    })
  },
  {
    id: 'syntax-generic',
    type: 'SyntaxError',
    matches: () => true,
    build: () => ({
      title: 'Python не зрозумів цей рядок',
      explanation: 'Десь тут написано не за правилами мови — найчастіше це дужка, лапки або двокрапка.',
      hint: 'Порівняй рядок із прикладом у завданні.'
    })
  },
  {
    id: 'index-out-of-range',
    type: 'IndexError',
    matches: (error) => /index out of range/.test(error.message),
    build: (error) => ({
      title: 'Такого елемента немає',
      explanation: /string/.test(error.message)
        ? 'Ти звертаєшся до символу, якого в рядку немає.'
        : 'Ти звертаєшся до елемента, якого в списку немає.',
      hint: 'Нумерація починається з 0, тому останній елемент має номер len(...) - 1.'
    })
  },
  {
    id: 'divide-by-zero',
    type: 'ZeroDivisionError',
    matches: () => true,
    build: () => ({
      title: 'Ділення на нуль',
      explanation: 'На нуль ділити не можна — у математики теж.',
      hint: 'Перевір дільник через if, перш ніж ділити.'
    })
  },
  {
    id: 'int-of-text',
    type: 'ValueError',
    matches: (error) => /invalid literal for int|could not convert string to float/.test(error.message),
    build: () => ({
      title: 'Це не схоже на число',
      explanation: 'int() і float() перетворюють на число лише текст, який складається з цифр.',
      hint: 'Якщо число вводить користувач, спробуй try / except ValueError, щоб попросити ще раз.'
    })
  },
  {
    id: 'module-attribute',
    type: 'AttributeError',
    matches: (error) => /module '(.+?)' has no attribute '(.+?)'/.test(error.message),
    build: (error) => {
      const match = /module '(.+?)' has no attribute '(.+?)'/.exec(error.message);
      return {
        title: `У модуля ${match?.[1]} немає команди ${match?.[2]}`,
        explanation: 'Такої назви команди не існує — найчастіше це одруківка.',
        hint: 'Перевір написання команди літера за літерою.'
      };
    }
  },
  {
    id: 'object-attribute',
    type: 'AttributeError',
    matches: (error) => /'(.+?)' object has no attribute '(.+?)'/.test(error.message),
    build: (error) => {
      const match = /'(.+?)' object has no attribute '(.+?)'/.exec(error.message);
      return {
        title: `${describeType(match?.[1])} не вміє ${match?.[2]}`,
        explanation: 'Ця дія існує для інших типів даних, але не для цього.',
        hint: 'Перевір, що саме лежить у змінній — можливо, там не те, що ти очікуєш.'
      };
    }
  },
  {
    id: 'not-callable',
    type: 'TypeError',
    matches: (error) => /object is not callable/.test(error.message),
    build: (error) => ({
      title: 'Це не функція',
      explanation: `Дужки після назви означають виклик функції, а тут ${describeType(
        /'(.+?)' object/.exec(error.message)?.[1]
      )}.`,
      hint: 'Прибери дужки або перевір, чи не збігається назва змінної з назвою функції.'
    })
  },
  {
    id: 'no-len',
    type: 'TypeError',
    matches: (error) => /has no len\(\)/.test(error.message),
    build: () => ({
      title: 'Довжину так не виміряти',
      explanation: 'len() рахує елементи рядка або списку, а в числа елементів немає.',
      hint: 'Якщо треба кількість цифр, спершу перетвори число на текст: len(str(n)).'
    })
  },
  {
    id: 'multiply-sequence',
    type: 'TypeError',
    matches: (error) => /can't multiply sequence by non-int/.test(error.message),
    build: () => ({
      title: 'Текст на текст не множиться',
      explanation: 'Рядок можна повторити ціле число разів, але не помножити на інший рядок.',
      hint: 'Якщо обидва значення мають бути числами, перетвори їх: int(...).'
    })
  },
  {
    id: 'argument-count',
    type: 'TypeError',
    matches: (error) => /positional argument/.test(error.message),
    build: () => ({
      title: 'Інша кількість аргументів',
      explanation: 'Функція чекає не стільки значень у дужках, скільки ти передав.',
      hint: 'Подивись на рядок з def — скільки імен у дужках, стільки значень і треба.'
    })
  },
  {
    id: 'unknown-module',
    type: 'ImportError',
    matches: (error) => /No module named/.test(error.message),
    build: (error) => ({
      title: `Модуля ${/No module named (\S+)/.exec(error.message)?.[1] ?? ''} тут немає`,
      explanation: 'У цьому середовищі доступні turtle, math, random і time.',
      hint: 'Перевір назву модуля або обійдись без нього.'
    })
  },
  {
    id: 'key-error',
    type: 'KeyError',
    matches: () => true,
    build: (error) => ({
      title: `У словнику немає ключа «${error.message}»`,
      explanation: 'Звернення d[ключ] працює лише тоді, коли такий ключ у словнику є.',
      hint: 'Перевір ключ через if ключ in d або скористайся d.get(ключ).'
    })
  }
];

const TYPE_NAMES: Record<string, string> = {
  str: 'текст',
  int: 'ціле число',
  float: 'дробове число',
  list: 'список',
  dict: 'словник',
  tuple: 'кортеж',
  bool: 'логічне значення',
  NoneType: 'порожнє значення None'
};

function describeType(type: string | undefined): string {
  if (!type) return 'це значення';
  return TYPE_NAMES[type] ?? `значення типу ${type}`;
}
