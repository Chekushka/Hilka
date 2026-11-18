import { describe, expect, it } from 'vitest';
import { boardOf, ownStanding, possiblePoints, raceStandings, taskPoints } from './race';

const roster = [
  { id: 'a', name: 'Аня' },
  { id: 'b', name: 'Богдан' },
  { id: 'c', name: 'Віра' }
];
const tasks = [
  { id: 't1', difficulty: 1 },
  { id: 't2', difficulty: 3 }
];
const at = (minute: number) => `2026-11-18T10:${String(minute).padStart(2, '0')}:00.000Z`;

describe('taskPoints', () => {
  it('gives 10 per level of difficulty and a bonus for a first-try pass', () => {
    expect(taskPoints(1, false)).toBe(10);
    expect(taskPoints(3, true)).toBe(35);
  });

  it('clamps difficulty to 1..5', () => {
    expect(taskPoints(0, false)).toBe(10);
    expect(taskPoints(9, false)).toBe(50);
  });
});

describe('possiblePoints', () => {
  it('sums every task at its best', () => {
    expect(possiblePoints(tasks, null)).toBe(15 + 35);
  });

  it('counts only the best pool-size tasks with a pool', () => {
    expect(possiblePoints(tasks, 1)).toBe(35);
  });
});

describe('raceStandings', () => {
  it('counts each task once, never takes points away, and ranks by points', () => {
    const standings = raceStandings(roster, tasks, [
      { studentId: 'a', taskId: 't1', passed: false, createdAt: at(1) },
      { studentId: 'a', taskId: 't1', passed: true, createdAt: at(2) },
      { studentId: 'a', taskId: 't1', passed: true, createdAt: at(3) },
      { studentId: 'b', taskId: 't2', passed: true, createdAt: at(4) }
    ]);
    expect(standings.map((row) => [row.studentId, row.points, row.place])).toEqual([
      ['b', 35, 1],
      ['a', 10, 2],
      ['c', 0, 3]
    ]);
    expect(standings[1].solved).toBe(1);
  });

  it('shares a place on equal points, the earlier one listed first', () => {
    const standings = raceStandings(roster, tasks, [
      { studentId: 'b', taskId: 't1', passed: true, createdAt: at(1) },
      { studentId: 'a', taskId: 't1', passed: true, createdAt: at(5) }
    ]);
    expect(standings.map((row) => [row.studentId, row.place])).toEqual([
      ['b', 1],
      ['a', 1],
      ['c', 3]
    ]);
  });

  it('ignores tasks outside the race', () => {
    const standings = raceStandings(roster, tasks, [{ studentId: 'c', taskId: 'route', passed: true, createdAt: at(1) }]);
    expect(standings.every((row) => row.points === 0)).toBe(true);
  });
});

describe('ownStanding and boardOf', () => {
  const standings = raceStandings(roster, tasks, [
    { studentId: 'a', taskId: 't2', passed: true, createdAt: at(1) },
    { studentId: 'b', taskId: 't1', passed: true, createdAt: at(2) }
  ]);

  it('says how many points reach the next place up', () => {
    expect(ownStanding(standings, 'b')).toMatchObject({ points: 15, place: 2, toNextPlace: 20, onBoard: true });
    expect(ownStanding(standings, 'a')?.toNextPlace).toBeNull();
    expect(ownStanding(standings, 'c')).toMatchObject({ points: 0, onBoard: false, toNextPlace: 15 });
    expect(ownStanding(standings, 'nobody')).toBeNull();
  });

  it('never puts a student with no points on the board', () => {
    expect(boardOf(standings, 10).map((row) => row.studentId)).toEqual(['a', 'b']);
  });
});
