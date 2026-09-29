/**
 * The grid robot (docs/TASK_SCHEMA.md, "Grid") — a module of our own, with no
 * CPython counterpart, so grid tasks never go out as IDLE files.
 *
 *   import robot            from robot import *
 *   robot.forward()         forward(3)      # cells ahead; stops at a rock or the edge
 *   robot.left()            right()         # quarter turns
 *   robot.at_goal()         can_move()      # for if and while
 *
 * A move into a rock or off the field does not raise: the robot stays put,
 * the step is recorded as a bump, and the program carries on — the picture
 * shows where it hit, which says more to a 12-year-old than a traceback. The
 * runner reports what happened (steps, bumps, whether it ended on the goal);
 * the `grid_goal` check decides whether that is a pass.
 *
 * Like turtle.ts, the body is JavaScript source handed to Skulpt as data.
 */
import type { GridRun, GridWorld } from '../types';

/** Worker-global state the injected module reads the world from and writes into. */
export interface RobotRecorder {
  world: GridWorld;
  /** Set on `import robot`; a run that never imports it reports no grid. */
  used: boolean;
  steps: GridRun['steps'];
  size: number;
  maxSteps: number;
}

export const GRID_SIZE = 8;

/** Enough for any sensible path; a runaway `while` hits it long before memory does. */
const MAX_STEPS = 2000;

/** Where an ad-hoc program (the dev runner page) starts when no task supplies a world. */
export const EMPTY_WORLD: GridWorld = { start: { x: 0, y: 0, dir: 'E' }, goal: { x: 7, y: 7 }, rocks: [] };

export function createRobotRecorder(world: GridWorld = EMPTY_WORLD): RobotRecorder {
  return { world, used: false, steps: [], size: GRID_SIZE, maxSteps: MAX_STEPS };
}

export function robotRun(recorder: RobotRecorder): GridRun | null {
  if (!recorder.used) return null;
  const last = recorder.steps[recorder.steps.length - 1];
  const goal = recorder.world.goal;
  return {
    steps: recorder.steps,
    reachedGoal: last !== undefined && last.x === goal.x && last.y === goal.y,
    bumps: recorder.steps.filter((step) => step.bump).length
  };
}

/** The path Skulpt looks up when a program says `import robot`. */
export const ROBOT_MODULE_PATH = 'src/lib/robot.js';

export const ROBOT_MODULE_SOURCE = `
var $builtinmodule = function (name) {
  var mod = {};
  var R = self.__robot__;
  var DIRS = ['N', 'E', 'S', 'W'];
  var DX = { N: 0, E: 1, S: 0, W: -1 };
  var DY = { N: -1, E: 0, S: 1, W: 0 };

  R.used = true;
  var s = R.world.start;
  R.steps.push({ x: s.x, y: s.y, dir: s.dir, bump: false });

  function here() { return R.steps[R.steps.length - 1]; }

  function record(step) {
    if (R.steps.length >= R.maxSteps) {
      // A loop that never reaches the goal: stop it the way the time limit
      // would, so it is explained as "did not finish", not as an error.
      throw new Sk.builtin.TimeLimitError('Program exceeded run time limit.');
    }
    R.steps.push(step);
  }

  function blocked(x, y) {
    if (x < 0 || y < 0 || x >= R.size || y >= R.size) { return true; }
    for (var i = 0; i < R.world.rocks.length; i++) {
      if (R.world.rocks[i].x === x && R.world.rocks[i].y === y) { return true; }
    }
    return false;
  }

  function turn(by) {
    var h = here();
    record({ x: h.x, y: h.y, dir: DIRS[(DIRS.indexOf(h.dir) + by + 4) % 4], bump: false });
  }

  var api = {
    forward: function (n) {
      var count = n === undefined ? 1 : Math.floor(n);
      for (var i = 0; i < count; i++) {
        var h = here();
        var nx = h.x + DX[h.dir];
        var ny = h.y + DY[h.dir];
        if (blocked(nx, ny)) {
          record({ x: h.x, y: h.y, dir: h.dir, bump: true });
          return;
        }
        record({ x: nx, y: ny, dir: h.dir, bump: false });
      }
    },
    left: function () { turn(-1); },
    right: function () { turn(1); },
    at_goal: function () {
      var h = here();
      return h.x === R.world.goal.x && h.y === R.world.goal.y;
    },
    can_move: function () {
      var h = here();
      return !blocked(h.x + DX[h.dir], h.y + DY[h.dir]);
    }
  };

  Object.keys(api).forEach(function (k) {
    mod[k] = new Sk.builtin.func(function (n) {
      var value = api[k](n === undefined ? undefined : Sk.ffi.remapToJs(n));
      if (typeof value === 'boolean') { return value ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$; }
      return Sk.builtin.none.none$;
    });
  });

  return mod;
};
`;
