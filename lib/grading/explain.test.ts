import { describe, expect, it } from 'vitest';
import uk from '@/messages/uk.json';
import { DEFAULT_GRADING } from './config';
import { gradeForShare } from './grade';
import { gradingScale, pointsMessageKey, sessionRules, taskLevel, type RulesInput } from './explain';
import { t } from '@/lib/i18n';

const lesson: RulesInput = {
  kind: 'lesson',
  mode: 'graded',
  hintsEnabled: true,
  timeLimitS: null,
  difficulties: [1, 3, 4],
  hasImprovementTasks: false
};

const keys = (input: RulesInput) => sessionRules(input).map((rule) => rule.key);

describe('sessionRules', () => {
  it('explains nothing where nothing is graded', () => {
    expect(sessionRules({ ...lesson, mode: 'practice' })).toEqual([]);
    // A class check has no grade of its own; its notice says what it does to the homework.
    expect(sessionRules({ ...lesson, kind: 'check' })).toEqual([]);
  });

  it('gives a graded lesson its one-attempt rule and the high band', () => {
    expect(keys(lesson)).toEqual([
      'firstCheckOnly',
      'runIsFree',
      'crashNotCounted',
      'points',
      'partialCases',
      'hints',
      'highBand',
      'teacherDecides'
    ]);
  });

  it('takes its numbers from the grading config', () => {
    const rules = sessionRules({ ...lesson, timeLimitS: 1800 });
    expect(rules.find((rule) => rule.key === 'points')?.values).toEqual({ pointsEasy: 1, pointsMedium: 2, pointsHard: 3 });
    expect(rules.find((rule) => rule.key === 'hints')?.values).toEqual({ credit: 75 });
    expect(rules.find((rule) => rule.key === 'timeLimit')?.values).toEqual({ minutes: 30 });
    expect(rules.find((rule) => rule.key === 'highBand')?.values).toEqual({ from: DEFAULT_GRADING.highBandCap + 1 });
  });

  it('leaves the hint rule out when hints are off', () => {
    expect(keys({ ...lesson, hintsEnabled: false })).not.toContain('hints');
  });

  it('says when the session cannot reach the high band', () => {
    const rules = sessionRules({ ...lesson, difficulties: [1, 2, 3] });
    expect(rules.find((rule) => rule.key === 'highBandUnavailable')?.values).toEqual({ cap: 9 });
    expect(rules.map((rule) => rule.key)).not.toContain('highBand');
  });

  it('gives homework its fixes, improvement and class check rules', () => {
    expect(keys({ ...lesson, kind: 'homework', hasImprovementTasks: true })).toEqual([
      'homeworkFirstCheck',
      'homeworkFixes',
      'runIsFree',
      'crashNotCounted',
      'points',
      'partialCases',
      'hints',
      'improvement',
      'classCheck',
      'homeworkHighBand',
      'teacherDecides'
    ]);
  });

  it('has a message for every rule, with every placeholder filled', () => {
    const rules = sessionRules({ ...lesson, kind: 'homework', hasImprovementTasks: true, timeLimitS: 600 });
    const all = [...rules, ...sessionRules({ ...lesson, difficulties: [1] })];
    const messages = (uk as unknown as { grading: { rules: Record<string, Record<string, string>> } }).grading.rules;
    for (const rule of all) {
      for (const part of ['badge', 'title', 'body']) {
        expect(messages[rule.key]?.[part], `${rule.key}.${part}`).toBeTypeOf('string');
        expect(t(`grading.rules.${rule.key}.${part}`, rule.values), `${rule.key}.${part}`).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe('gradingScale', () => {
  it('has four levels of three grades', () => {
    const scale = gradingScale();
    expect(scale.map((level) => level.level)).toEqual(['initial', 'average', 'sufficient', 'high']);
    expect(scale.flatMap((level) => level.rows.map((row) => row.grade))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('shows the agreed level boundaries', () => {
    const rows = gradingScale().flatMap((level) => level.rows);
    expect(rows[0]).toEqual({ grade: 1, from: 0, to: 5 });
    expect(rows[2].to).toBe(15);
    expect(rows[5].to).toBe(60);
    expect(rows[8].to).toBe(75);
    expect(rows[9]).toEqual({ grade: 10, from: 75, to: 83.3 });
    expect(rows[11]).toEqual({ grade: 12, from: 91.7, to: 100 });
  });

  it('agrees with gradeForShare at every boundary it shows', () => {
    for (const row of gradingScale().flatMap((level) => level.rows)) {
      // Within the tenth of a percent the display rounds to.
      expect(gradeForShare((row.to - 0.1) / 100)).toBe(row.grade);
      if (row.grade > 1) expect(gradeForShare((row.from + 0.1) / 100)).toBe(row.grade);
    }
  });
});

describe('taskLevel and points', () => {
  it('calls hard exactly what opens the high band', () => {
    expect([1, 2, 3, 4, 5].map((d) => taskLevel(d))).toEqual(['easy', 'easy', 'medium', 'hard', 'hard']);
  });

  it('words points in Ukrainian', () => {
    expect(t(pointsMessageKey(1), { n: 1 })).toBe('1 бал');
    expect(t(pointsMessageKey(2), { n: 2 })).toBe('2 бали');
    expect(t(pointsMessageKey(3), { n: 3 })).toBe('3 бали');
    expect(t(pointsMessageKey(5), { n: 5 })).toBe('5 балів');
  });
});
