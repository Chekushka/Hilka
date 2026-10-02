import { describe, expect, it } from 'vitest';
import { assignTasks } from './assignment';

const TASKS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const NAMES = ['Олена', 'Тарас', 'Соломія', 'Ігор', 'Марко', 'Яна', 'Богдан', 'Ліза', 'Максим', 'Софія'];

describe('assignTasks', () => {
  it('leaves the teacher’s list as is with no pool and no shuffle', () => {
    expect(assignTasks(TASKS, 's1', 'Олена', { poolSize: null, shuffle: false })).toEqual(TASKS);
    expect(assignTasks(TASKS, 's1', 'Олена', { poolSize: 8, shuffle: false })).toEqual(TASKS);
    expect(assignTasks(TASKS, 's1', 'Олена', { poolSize: 20, shuffle: false })).toEqual(TASKS);
  });

  it('gives the same student the same tasks in the same order every time', () => {
    const rule = { poolSize: 5, shuffle: true };
    const first = assignTasks(TASKS, 's1', 'Олена', rule);
    for (let i = 0; i < 5; i += 1) expect(assignTasks(TASKS, 's1', 'Олена', rule)).toEqual(first);
  });

  it('gives each student K of the tasks, in the teacher’s order, and not everyone the same K', () => {
    const pools = NAMES.map((name) => assignTasks(TASKS, 's1', name, { poolSize: 5, shuffle: false }));
    for (const pool of pools) {
      expect(pool).toHaveLength(5);
      expect(new Set(pool).size).toBe(5);
      expect(pool).toEqual(TASKS.filter((task) => pool.includes(task)));
    }
    expect(new Set(pools.map((pool) => pool.join())).size).toBeGreaterThan(1);
  });

  it('shuffles each student’s order, the same tasks either way', () => {
    const orders = NAMES.map((name) => assignTasks(TASKS, 's1', name, { poolSize: null, shuffle: true }));
    for (const order of orders) expect([...order].sort()).toEqual(TASKS);
    expect(new Set(orders.map((order) => order.join())).size).toBeGreaterThan(1);
  });

  it('draws differently in another session', () => {
    const rule = { poolSize: 3, shuffle: true };
    const here = NAMES.map((name) => assignTasks(TASKS, 's1', name, rule).join());
    const there = NAMES.map((name) => assignTasks(TASKS, 's2', name, rule).join());
    expect(here).not.toEqual(there);
  });

  it('does not change which tasks a student gets when shuffle is switched on', () => {
    const plain = assignTasks(TASKS, 's1', 'Тарас', { poolSize: 4, shuffle: false });
    const mixed = assignTasks(TASKS, 's1', 'Тарас', { poolSize: 4, shuffle: true });
    expect([...mixed].sort()).toEqual([...plain].sort());
  });
});
