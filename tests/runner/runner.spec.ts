import { expect, test, type Page } from '@playwright/test';
import type { RunResult } from '@/lib/runner';

/**
 * One test per curriculum construct that actually runs Python, plus the two
 * behaviours the whole design rests on: right(90) ≡ left(270), and a timeout
 * that does not punish a slow typist.
 */

async function run(
  page: Page,
  code: string,
  options: { stdin?: string[]; timeoutMs?: number; randomSeed?: number } = {}
): Promise<RunResult> {
  return page.evaluate(
    ([source, opts]) =>
      window.__runner__!.run(source as string, {
        mode: 'headless',
        ...(opts as object)
      }),
    [code, options] as const
  );
}

/** Normalization from AI_CONTEXT.md: round to 1 px, canonical endpoints, set. */
function normalize(segments: RunResult['drawing']): string[] {
  const seen = new Set<string>();
  for (const s of segments) {
    const a: [number, number] = [Math.round(s.x1), Math.round(s.y1)];
    const b: [number, number] = [Math.round(s.x2), Math.round(s.y2)];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const ordered = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a];
    seen.add(JSON.stringify(ordered));
  }
  return [...seen].sort();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/runner');
  await page.waitForFunction(() => window.__runner__ !== undefined);
});

test('variables and arithmetic', async ({ page }) => {
  const result = await run(page, 'a = 7\nb = 3\nprint(a * b, a // b, a % b, a ** 2)');
  expect(result.error).toBeNull();
  expect(result.stdout.trim()).toBe('21 2 1 49');
});

test('if / elif / else', async ({ page }) => {
  const result = await run(page, 'n = 5\nif n > 10:\n    print("big")\nelif n > 3:\n    print("medium")\nelse:\n    print("small")');
  expect(result.stdout.trim()).toBe('medium');
});

test('while', async ({ page }) => {
  const result = await run(page, 'i = 0\nwhile i < 3:\n    print(i)\n    i = i + 1');
  expect(result.stdout.trim().split('\n')).toEqual(['0', '1', '2']);
});

test('for over range', async ({ page }) => {
  const result = await run(page, 'total = 0\nfor i in range(1, 5):\n    total = total + i\nprint(total)');
  expect(result.stdout.trim()).toBe('10');
});

test('input from a queued stdin', async ({ page }) => {
  const result = await run(page, 'w = float(input())\nh = float(input())\nprint(round(w / h ** 2, 2))', {
    stdin: ['70', '1.75']
  });
  expect(result.error).toBeNull();
  expect(result.inputsConsumed).toBe(2);
  expect(result.stdout.trim()).toBe('22.86');
});

test('Cyrillic survives literals, f-strings and output', async ({ page }) => {
  const result = await run(page, 'name = "світ"\nprint(f"Привіт, {name}!")\nprint(len("їжак"))');
  expect(result.stdout.trim().split('\n')).toEqual(['Привіт, світ!', '4']);
});

test('try / except', async ({ page }) => {
  const result = await run(page, 'try:\n    int("nope")\nexcept ValueError:\n    print("caught")');
  expect(result.error).toBeNull();
  expect(result.stdout.trim()).toBe('caught');
});

test('turtle records segments and draws nothing', async ({ page }) => {
  const result = await run(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  expect(result.error).toBeNull();
  expect(result.drawing).toHaveLength(4);
  expect(result.drawing[0]).toMatchObject({ x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' });
});

test('penup leaves a gap in the segment log', async ({ page }) => {
  const result = await run(page, 'import turtle\nturtle.forward(50)\nturtle.penup()\nturtle.forward(50)\nturtle.pendown()\nturtle.forward(50)');
  expect(result.drawing).toHaveLength(2);
});

test('right(90) and left(270) produce the same picture', async ({ page }) => {
  // The equivalence the entire turtle comparison design rests on. A student who
  // turns the other way is not wrong, and failing them is exactly the event
  // that makes a reluctant student close the tab.
  const clockwise = await run(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  const widdershins = await run(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.left(270)');
  expect(normalize(clockwise.drawing)).toEqual(normalize(widdershins.drawing));
  expect(normalize(clockwise.drawing)).toHaveLength(4);
});

test('random is reproducible when seeded', async ({ page }) => {
  const code = 'import random\nprint([random.randint(1, 100) for i in range(5)])';
  const first = await run(page, code, { randomSeed: 42 });
  const second = await run(page, code, { randomSeed: 42 });
  const different = await run(page, code, { randomSeed: 7 });
  expect(first.error).toBeNull();
  expect(first.stdout).toBe(second.stdout);
  expect(first.stdout).not.toBe(different.stdout);
});

test('an infinite loop times out instead of hanging', async ({ page }) => {
  const result = await run(page, 'while True:\n    pass', { timeoutMs: 1500 });
  expect(result.timedOut).toBe(true);
  expect(result.error?.type).toBe('TimeLimitError');
});

test('waiting for input does not count against the limit', async ({ page }) => {
  // A slow typist must never be told their program stopped responding.
  const result = await page.evaluate(() =>
    window.__runner__!.runInteractive('x = input("Друкуй повільно: ")\nprint(x)', ['готово'], 2500)
  );
  expect(result.timedOut).toBe(false);
  expect(result.error).toBeNull();
  expect(result.stdout.trim()).toBe('готово');
});

test('an error carries type, message and line', async ({ page }) => {
  const result = await run(page, 'age = input()\nprint(age + 1)', { stdin: ['12'] });
  expect(result.error).toMatchObject({ type: 'TypeError', line: 2 });
  expect(result.error?.message).toContain('concatenate');
});
