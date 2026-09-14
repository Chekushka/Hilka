/**
 * random, replaced.
 *
 * Grade 9 writes programs that use random, and a program whose output is
 * genuinely random cannot be checked. In headless mode the runner seeds this
 * deterministically, so the same task and the same student produce the same
 * numbers every time and a teacher's report reproduces exactly what was seen.
 * In interactive mode the seed comes from Math.random and the randomness is
 * real — a dice game that always rolls the same number teaches the wrong thing.
 *
 * Seeding Skulpt's own random module from outside does not survive between
 * module bodies, which is why this replaces the module rather than calling into
 * it. Same mechanism as the turtle stub: source text handed to the interpreter.
 */

export const RANDOM_MODULE_PATH = 'src/lib/random.js';

export const RANDOM_MODULE_SOURCE = `
var $builtinmodule = function (name) {
  var mod = {};

  // mulberry32: small, fast, and good enough for dice and shuffles.
  var state = (self.__randomSeed__ >>> 0) || 1;
  function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    var t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function toJs(v) { return Sk.ffi.remapToJs(v); }
  function toPy(v) { return Sk.ffi.remapToPy(v); }

  mod.seed = new Sk.builtin.func(function (n) {
    state = (n === undefined ? Date.now() : Number(toJs(n))) >>> 0 || 1;
    return Sk.builtin.none.none$;
  });

  mod.random = new Sk.builtin.func(function () {
    return new Sk.builtin.float_(next());
  });

  mod.randint = new Sk.builtin.func(function (a, b) {
    var lo = Math.ceil(Number(toJs(a)));
    var hi = Math.floor(Number(toJs(b)));
    return new Sk.builtin.int_(lo + Math.floor(next() * (hi - lo + 1)));
  });

  mod.randrange = new Sk.builtin.func(function (a, b, step) {
    var start = Number(toJs(a));
    var stop = b === undefined ? null : Number(toJs(b));
    var by = step === undefined ? 1 : Number(toJs(step));
    if (stop === null) { stop = start; start = 0; }
    var count = Math.ceil((stop - start) / by);
    return new Sk.builtin.int_(start + by * Math.floor(next() * count));
  });

  mod.uniform = new Sk.builtin.func(function (a, b) {
    var lo = Number(toJs(a));
    var hi = Number(toJs(b));
    return new Sk.builtin.float_(lo + next() * (hi - lo));
  });

  mod.choice = new Sk.builtin.func(function (seq) {
    var items = toJs(seq);
    return toPy(items[Math.floor(next() * items.length)]);
  });

  mod.shuffle = new Sk.builtin.func(function (seq) {
    // Python shuffles in place, so this mutates the list's own backing array.
    var items = seq.v;
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
    }
    return Sk.builtin.none.none$;
  });

  mod.sample = new Sk.builtin.func(function (seq, k) {
    var items = toJs(seq).slice();
    var count = Number(toJs(k));
    var picked = [];
    for (var i = 0; i < count && items.length; i++) {
      picked.push(items.splice(Math.floor(next() * items.length), 1)[0]);
    }
    return toPy(picked);
  });

  return mod;
};
`;
