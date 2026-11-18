import { describe, expect, it } from 'vitest';
import {
  checkMemoryRuns,
  flowShapeProblems,
  memoryBoxes,
  memoryRunRequests,
  memoryShapeProblems,
  parseFlow,
  parseMemory,
  type MemoryRun
} from './visuals';

const MEMORY = 'x = 5\n> x = 5\ny = x + 2\n> y = 7\nx = x * 2\n> x = 10';
const markdown = (body: string, lang = 'memory') => `Ідея\n\n\`\`\`${lang}\n${body}\n\`\`\`\n`;

describe('parseMemory', () => {
  it('reads each code line with the variables it changes', () => {
    const memory = parseMemory(MEMORY);
    expect(memory.problems).toEqual([]);
    expect(memory.steps).toEqual([
      { line: 'x = 5', changes: [{ name: 'x', value: '5' }] },
      { line: 'y = x + 2', changes: [{ name: 'y', value: '7' }] },
      { line: 'x = x * 2', changes: [{ name: 'x', value: '10' }] }
    ]);
  });

  it('refuses blocks, input(), values that are not literals and a change before any code', () => {
    expect(parseMemory('if x:\n    y = 1').problems).toContain('notStraightLine');
    expect(parseMemory('x = input()').problems).toContain('readsInput');
    expect(parseMemory('x = 5\n> x = 2 + 3').problems).toContain('badChange');
    expect(parseMemory('> x = 5\nx = 5').problems).toContain('changeBeforeCode');
    expect(parseMemory('').problems).toContain('noSteps');
  });

  it('accepts Cyrillic names and string, float and boolean literals', () => {
    expect(parseMemory('місто = "Київ"\n> місто = "Київ"\nt = 3.5\n> t = 3.5\nok = True\n> ok = True').problems).toEqual([]);
  });
});

describe('memoryBoxes', () => {
  it('shows every variable met so far, the changed one with its old value', () => {
    const memory = parseMemory(MEMORY);
    expect(memoryBoxes(memory, 0)).toEqual([{ name: 'x', value: '5', changed: true, previous: null }]);
    expect(memoryBoxes(memory, 2)).toEqual([
      { name: 'x', value: '10', changed: true, previous: '5' },
      { name: 'y', value: '7', changed: false, previous: null }
    ]);
  });
});

describe('checkMemoryRuns', () => {
  const md = markdown(MEMORY);
  const passing = (): MemoryRun[] =>
    memoryRunRequests(parseMemory(MEMORY)).map((request, step) => ({
      code: request.code,
      exprResults: Object.fromEntries(request.exprs.map((expr) => [expr, true])),
      names: step === 0 ? ['x'] : ['x', 'y'],
      failed: false
    }));

  it('runs every step so far with repr checks of every box', () => {
    const requests = memoryRunRequests(parseMemory(MEMORY));
    expect(requests.map((request) => request.code)).toEqual(['x = 5', 'x = 5\ny = x + 2', 'x = 5\ny = x + 2\nx = x * 2']);
    expect(requests[2].exprs).toEqual(['repr(x) == repr(10)', 'repr(y) == repr(7)']);
  });

  it('accepts runs that prove every value', () => {
    expect(checkMemoryRuns(md, passing())).toEqual([]);
  });

  it('names a value the run does not confirm, a missing run and a variable the block hides', () => {
    const runs = passing();
    runs[2].exprResults['repr(x) == repr(10)'] = false;
    expect(checkMemoryRuns(md, runs)).toEqual([{ memory: 1, step: 3, problem: 'valueWrong', name: 'x' }]);
    expect(checkMemoryRuns(md, passing().slice(0, 1))).toEqual([{ memory: 1, step: 2, problem: 'notRun' }]);
    const hidden = passing();
    hidden[1].names = ['x', 'y', 'z'];
    expect(checkMemoryRuns(md, hidden)).toEqual([{ memory: 1, step: 2, problem: 'unlisted', name: 'z' }]);
  });

  it('reports malformed blocks as shape problems, not runs', () => {
    const bad = markdown('if x:\n    y = 1');
    expect(memoryShapeProblems(bad)).toEqual([{ memory: 1, problem: 'notStraightLine' }]);
    expect(checkMemoryRuns(bad, [])).toEqual([]);
  });
});

describe('parseFlow', () => {
  it('reads a branch', () => {
    expect(parseFlow('? t > 20\nтак: print("Тепло")\nні: print("Прохолодно")')).toEqual({
      kind: 'if',
      condition: 't > 20',
      yes: ['print("Тепло")'],
      no: ['print("Прохолодно")'],
      problems: []
    });
  });

  it('reads a loop with what comes after it', () => {
    expect(parseFlow('поки n > 0\nповтор: print(n)\nповтор: n = n - 1\nдалі: print("Старт!")')).toEqual({
      kind: 'while',
      condition: 'n > 0',
      body: ['print(n)', 'n = n - 1'],
      after: ['print("Старт!")'],
      problems: []
    });
  });

  it('names what is missing or mistyped', () => {
    expect(parseFlow('так: x').problems).toContain('noCondition');
    expect(parseFlow('? x > 1').problems).toContain('noBranch');
    expect(parseFlow('? x > 1\nтак: a\nповтор: b').problems).toContain('unknownLine');
    expect(flowShapeProblems(markdown('поки x\nдалі: y', 'flow'))).toEqual([{ flow: 1, problem: 'noBranch' }]);
  });
});
