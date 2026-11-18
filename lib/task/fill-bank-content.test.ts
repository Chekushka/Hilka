import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillFromBank, isFillBankValid } from './fill';
import { isFillPayload } from './payload-guards';

/**
 * Every drag task committed in content/ (a `fill` with a word bank) can be
 * solved by dragging: its bank has the right shape and builds the reference —
 * the rule the publish route enforces, held against the seed, which has no
 * publish step of its own. That the reference passes its checks is
 * `npm run verify:references`.
 */
const dir = path.join(process.cwd(), 'content', 'seed-tasks');
const bankTasks = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as {
    slug: string;
    payload: { type: string; template: string; bank?: string[] };
    reference?: { code: string };
  })
  .filter((task) => task.payload.type === 'fill' && task.payload.bank !== undefined);

describe('drag tasks in content/', () => {
  it('exist', () => {
    expect(bankTasks.length).toBeGreaterThan(0);
  });

  it.each(bankTasks.map((task) => [task.slug, task] as const))('%s builds its reference from its cards', (_slug, task) => {
    expect(isFillPayload(task.payload)).toBe(true);
    expect(isFillBankValid(task.payload.template, task.payload.bank)).toBe(true);
    expect(fillFromBank(task.payload.template, task.payload.bank!, task.reference!.code)).not.toBeNull();
  });
});
