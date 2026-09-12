// Turtle stub for the spike — SPIKE.md check 2.
//
// Replaces Skulpt's own turtle module, which renders into a DOM element that
// does not exist inside a Worker. This one records geometry and draws nothing.
// Rendering happens on the main thread from the segment log, which is also what
// makes comparison-by-shape and playback possible later (AI_CONTEXT.md, Turtle).
//
// Injected as the contents of src/lib/turtle.js in Sk.builtinFiles.files, i.e.
// Skulpt evaluates this text and calls $builtinmodule.
var $builtinmodule = function (name) {
  var mod = {};
  var T = self.__turtle__;

  function rad(d) { return (d * Math.PI) / 180; }

  // The one place a source line could come from. Skulpt's compiler emits
  // $currLineNo as a local of the compiled function, so this is expected to be
  // undefined — the spike records what actually arrives rather than assuming.
  function currentLine() {
    var n = (typeof Sk !== 'undefined' && Sk.currLineNo !== undefined) ? Sk.currLineNo : null;
    if (n !== null && n !== undefined) { T.lineSeen = true; }
    return (n === undefined) ? null : n;
  }

  function moveTo(nx, ny) {
    if (T.pen) {
      T.segments.push({
        x1: T.x, y1: T.y, x2: nx, y2: ny,
        color: T.color, width: T.width, line: currentLine()
      });
    }
    T.x = nx; T.y = ny;
  }

  var api = {
    forward: function (d) {
      moveTo(T.x + d * Math.cos(rad(T.heading)), T.y + d * Math.sin(rad(T.heading)));
    },
    backward: function (d) { api.forward(-d); },
    right: function (a) { T.heading = (T.heading - a) % 360; },
    left: function (a) { T.heading = (T.heading + a) % 360; },
    goto: function (x, y) { moveTo(x, y); },
    setx: function (x) { moveTo(x, T.y); },
    sety: function (y) { moveTo(T.x, y); },
    setheading: function (a) { T.heading = a % 360; },
    home: function () { moveTo(0, 0); T.heading = 0; },
    penup: function () { T.pen = false; },
    pendown: function () { T.pen = true; },
    pencolor: function (c) { if (c !== undefined) { T.color = String(c); } },
    pensize: function (w) { if (w !== undefined) { T.width = Number(w); } },
    speed: function () { /* no-op: nothing is animated */ },
    dot: function (size) {
      var s = size === undefined ? T.width : Number(size);
      T.dots.push({ x: T.x, y: T.y, size: s, color: T.color, line: currentLine() });
    },
    circle: function (r, extent) {
      var ext = (extent === undefined || extent === null) ? 360 : extent;
      var steps = Math.max(4, Math.ceil(Math.abs(ext) / 10));
      var w = ext / steps;
      var chord = 2 * r * Math.sin(rad(w / 2));
      api.left(w / 2);
      for (var i = 0; i < steps; i++) { api.forward(chord); api.left(w); }
      api.right(w / 2);
    },
    reset: function () {
      T.segments.length = 0; T.dots.length = 0;
      T.x = 0; T.y = 0; T.heading = 0; T.pen = true; T.color = 'black'; T.width = 1;
    },
    clear: function () { T.segments.length = 0; T.dots.length = 0; },
    // Accepted and ignored: they affect appearance, not geometry.
    shape: function () {}, color: function (c) { api.pencolor(c); },
    width: function (w) { api.pensize(w); },
    begin_fill: function () {}, end_fill: function () {},
    hideturtle: function () {}, showturtle: function () {},
    done: function () {}, mainloop: function () {}, exitonclick: function () {}
  };

  var ALIASES = {
    fd: 'forward', bk: 'backward', back: 'backward', rt: 'right', lt: 'left',
    pu: 'penup', up: 'penup', pd: 'pendown', down: 'pendown', seth: 'setheading',
    setpos: 'goto', setposition: 'goto', ht: 'hideturtle', st: 'showturtle'
  };

  function toJs(v) {
    return (v === undefined || v === null) ? undefined : Sk.ffi.remapToJs(v);
  }

  function wrap(fn, dropSelf) {
    return new Sk.builtin.func(function () {
      var args = Array.prototype.slice.call(arguments, dropSelf ? 1 : 0).map(toJs);
      T.calls.push(fn);
      api[fn].apply(null, args);
      return Sk.builtin.none.none$;
    });
  }

  Object.keys(api).forEach(function (k) { mod[k] = wrap(k, false); });
  Object.keys(ALIASES).forEach(function (k) { mod[k] = wrap(ALIASES[k], false); });

  // t = turtle.Turtle() is as common in the textbooks as the module-level form.
  // One shared pen is enough for the spike; a second turtle would need its own state.
  mod.Turtle = Sk.misceval.buildClass(mod, function ($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function () { return Sk.builtin.none.none$; });
    Object.keys(api).forEach(function (k) { $loc[k] = wrap(k, true); });
    Object.keys(ALIASES).forEach(function (k) { $loc[k] = wrap(ALIASES[k], true); });
  }, 'Turtle', []);

  mod.Screen = Sk.misceval.buildClass(mod, function ($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function () { return Sk.builtin.none.none$; });
    ['setup', 'bgcolor', 'title', 'exitonclick', 'tracer', 'update', 'mainloop']
      .forEach(function (k) {
        $loc[k] = new Sk.builtin.func(function () { return Sk.builtin.none.none$; });
      });
  }, 'Screen', []);

  return mod;
};
