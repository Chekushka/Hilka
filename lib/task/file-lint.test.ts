import { describe, expect, it } from 'vitest';
import { parseInNode } from '@/lib/runner/node';
import { lintFile, type LintFinding } from './file-lint';

/** Parses with the real engine, exactly as the upload path does. */
function lint(source: string): LintFinding[] {
  return lintFile(parseInNode(source), source);
}

function names(source: string): string[] {
  return lint(source).map((f) => `${f.kind}:${f.name}`);
}

describe('lintFile — accepts what the safe subset covers', () => {
  it('passes a typical grade 8 project', () => {
    const source = `import math
w = float(input("Вага: "))
h = float(input("Зріст: "))
bmi = w / h ** 2
if bmi < 18.5:
    print("Недостатня вага")
elif bmi < 25:
    print(f"Норма: {bmi:.2f}")
else:
    print("Надлишкова вага", round(bmi, 1), math.sqrt(bmi))
`;
    expect(lint(source)).toEqual([]);
  });

  it('passes grade 9 lists, strings, random and try/except', () => {
    const source = `import random
words = input().split()
counts = {}
for w in words:
    counts[w] = counts.get(w, 0) + 1
best = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
secret = random.randint(1, 10)
try:
    guess = int(input())
except ValueError:
    guess = 0
print([w.upper() for w in words if w.isdigit()], best[:3], guess == secret, f"{0.25:.0%}")
`;
    expect(lint(source)).toEqual([]);
  });

  it('passes turtle code in the forms the stub implements', () => {
    const source = `import turtle
t = turtle.Turtle()
t.pencolor("red")
t.pensize(3)
for i in range(4):
    t.forward(100)
    t.left(90)
t.goto(0, 50)
t.circle(30, 180)
turtle.circle(20, extent=90)
t.dot(5)
turtle.done()
`;
    expect(lint(source)).toEqual([]);
  });

  it('passes the letter and case methods, Unicode-aware in the runner', () => {
    expect(lint('s = input()\nprint(s.isalpha(), s.isalnum(), s.isupper(), s.islower(), s.istitle(), s.title(), s.swapcase())\n')).toEqual([]);
  });

  it('passes `from turtle import *`', () => {
    expect(lint('from turtle import *\nforward(100)\nleft(90)\ncolor("blue")\n')).toEqual([]);
  });

  it('leaves a genuine SyntaxError to the runner', () => {
    expect(lint('print("hi"\n')).toEqual([]);
  });

  it('leaves a typo alone: it is the student\'s error, not a platform limitation', () => {
    expect(lint('import math\nprint(math.sqr(4), prnt(1), "a".uper())\n')).toEqual([]);
  });

  it('does not treat a student\'s own name as a builtin', () => {
    expect(lint('def open(x):\n    return x\nprint(open(1))\n')).toEqual([]);
  });

  it('does not mistake dict.update for turtle\'s update', () => {
    expect(lint('import turtle\nd = {}\nd.update({1: 2})\n')).toEqual([]);
  });
});

describe('lintFile — rejects what Hilka cannot be trusted to run', () => {
  it('rejects a module outside the subset', () => {
    expect(names('import os\nprint(os.getcwd())\n')).toEqual(['module:os']);
  });

  it('rejects files and classes, with a replacement', () => {
    const findings = lint('with open("a.txt") as f:\n    print(f.read())\n');
    expect(findings.map((f) => `${f.kind}:${f.name}`)).toContain('syntax:with');
    expect(findings.find((f) => f.name === 'with')?.replacement).toBe('withOpen');
    expect(names('class A:\n    pass\n')).toEqual(['syntax:class']);
  });

  it('rejects an unconfirmed builtin', () => {
    expect(names('print(eval("1+1"))\n')).toEqual(['builtin:eval']);
  });

  it('rejects an unconfirmed module attribute, however it is imported', () => {
    expect(names('import math\nprint(math.prod([1, 2]))\n')).toEqual(['module_attr:math.prod']);
    expect(names('from math import prod\nprint(prod([1, 2]))\n')).toEqual(['module_attr:math.prod']);
    expect(names('from math import *\nprint(prod([1, 2]))\n')).toEqual(['module_attr:math.prod']);
  });

  it('rejects an unconfirmed str method, naming its line', () => {
    expect(lint('s = input()\nprint(s.casefold(), s.isnumeric())\n')).toEqual([
      { kind: 'method', name: '.casefold()', line: 2 },
      { kind: 'method', name: '.isnumeric()', line: 2 }
    ]);
  });

  it('rejects turtle call forms the stub does not implement', () => {
    expect(names('import turtle\nturtle.goto((10, 20))\n')).toEqual(['turtle_call:goto']);
    expect(names('import turtle\nt = turtle.Turtle()\nt.pencolor(255, 0, 0)\n')).toEqual(['turtle_call:pencolor']);
    expect(names('import turtle\nturtle.circle(50, steps=6)\n')).toEqual(['turtle_call:circle']);
    expect(names('import turtle\nprint(turtle.pensize())\n')).toEqual(['turtle_call:pensize']);
    expect(names('from turtle import *\nsetpos((1, 2))\n')).toEqual(['turtle_call:goto']);
  });

  it('rejects turtle functions the stub does not have', () => {
    expect(names('import turtle\nturtle.fillcolor("red")\n')).toEqual(['module_attr:turtle.fillcolor']);
    expect(names('import turtle\nt = turtle.Turtle()\nt.stamp()\n')).toEqual(['method:.stamp()']);
  });

  it('rejects an unconfirmed format spec, but not the confirmed ones', () => {
    expect(names('x = 5\nprint(f"{x:x} {x:+d}")\n')).toEqual(['format_spec::x', 'format_spec::+d']);
    expect(names('x = 5\nw = 3\nprint(f"{x:{w}}")\n')).toEqual(['format_spec:{…:{…}}']);
    expect(lint('x = 5.5\nprint(f"{x:.2f} {x:>8} {x:08.3f} {x:,} {x:.1%} {x:.2e} {7:d}")\n')).toEqual([]);
  });

  it('reports the line of a construct inside an f-string, not line 1', () => {
    expect(lint('x = 1\n\nprint(f"{x:+d}")\n')[0].line).toBe(3);
  });
});

describe('lintFile — syntax Skulpt cannot parse at all', () => {
  it('recognizes :=', () => {
    expect(lint('x = 1\nif (n := 5) > 3:\n    print(n)\n')).toEqual([
      { kind: 'syntax', name: ':=', line: 2, replacement: 'walrus' }
    ]);
  });

  it('recognizes f"{x=}"', () => {
    expect(names('x = 5\nprint(f"{x=}")\n')).toEqual(['syntax:f"{x=}"']);
  });

  it('recognizes match', () => {
    expect(names('x = 1\nmatch x:\n    case 1:\n        print(1)\n')).toEqual(['syntax:match']);
  });

  it('ignores := and match inside strings and comments', () => {
    expect(lint('print("a := b"  # x := 1\n')).toEqual([]);
    expect(lint('match = 1\nprint(match\n')).toEqual([]);
  });

  it('does not take == or != inside an f-string for the debug form', () => {
    expect(lint('x = 1\nprint(f"{x == 1} {x != 2}"\n')).toEqual([]);
  });
});
