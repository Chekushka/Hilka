// Spike worker — everything Python-related happens here, never on the main
// thread (AI_CONTEXT.md, Architecture). One run at a time.
//
// Protocol
//   in : {type:'run', code, mode, stdin, timeoutMs}
//        {type:'input', value}
//   out: {type:'ready'|'stdout'|'input-request'|'done', ...}

importScripts('vendor/skulpt.min.js', 'vendor/skulpt-stdlib.js');

// Recording state for the turtle stub, which reads it off the worker global.
self.__turtle__ = {
  segments: [], dots: [], calls: [], lineSeen: false,
  x: 0, y: 0, heading: 0, pen: true, color: 'black', width: 1
};

var turtleStubSource = null;
var pendingInput = null;
var stdinQueue = [];
var mode = 'headless';
var inputsConsumed = 0;
var stdout = '';

function builtinRead(x) {
  if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[x] === undefined) {
    throw new Error("File not found: '" + x + "'");
  }
  return Sk.builtinFiles.files[x];
}

// SPIKE.md check 2, first question: can the module be replaced before execution?
fetch('turtle-stub.js')
  .then(function (r) { return r.text(); })
  .then(function (src) {
    turtleStubSource = src;
    Sk.builtinFiles.files['src/lib/turtle.js'] = src;
    postMessage({
      type: 'ready',
      replaced: Sk.builtinFiles.files['src/lib/turtle.js'] === src,
      // Objective evidence for check 3's last row: no COOP/COEP headers are set,
      // so SharedArrayBuffer is unavailable here. If input still works, it does
      // not need one.
      crossOriginIsolated: self.crossOriginIsolated === true,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
    });
  });

function describeError(e) {
  if (!e) { return null; }
  var out = { type: null, message: null, line: null, col: null, raw: String(e) };
  out.type = e.tp$name || (e.constructor && e.constructor.name) || typeof e;
  try {
    if (e.args && e.args.v && e.args.v.length) {
      out.message = Sk.ffi.remapToJs(e.args.v[0]);
    }
  } catch (_) { /* leave message null, raw still carries it */ }
  var tb = e.traceback && e.traceback.length ? e.traceback[0] : null;
  if (tb) {
    out.line = tb.lineno === undefined ? null : tb.lineno;
    out.col = tb.colno === undefined ? null : tb.colno;
  }
  return out;
}

function run(msg) {
  var T = self.__turtle__;
  T.segments = []; T.dots = []; T.calls = []; T.lineSeen = false;
  T.x = 0; T.y = 0; T.heading = 0; T.pen = true; T.color = 'black'; T.width = 1;

  mode = msg.mode || 'headless';
  stdinQueue = (msg.stdin || []).slice();
  inputsConsumed = 0;
  stdout = '';
  var inputWaitMs = 0;

  Sk.configure({
    output: function (text) {
      stdout += text;
      postMessage({ type: 'stdout', chunk: text });
    },
    read: builtinRead,
    inputfunTakesPrompt: true,
    inputfun: function (prompt) {
      if (mode === 'headless') {
        if (stdinQueue.length === 0) {
          throw new Sk.builtin.EOFError('EOF when reading a line');
        }
        inputsConsumed += 1;
        return stdinQueue.shift();
      }
      var started = Date.now();
      postMessage({ type: 'input-request', prompt: prompt === undefined ? '' : prompt });
      return new Promise(function (resolve) {
        pendingInput = function (value) {
          var waited = Date.now() - started;
          inputWaitMs += waited;
          // SPIKE.md check 4: the limit is wall-clock, so waiting for a slow
          // typist would otherwise be charged as execution time. Push the start
          // forward by however long the student took.
          Sk.execStart = new Date(Number(Sk.execStart) + waited);
          inputsConsumed += 1;
          pendingInput = null;
          resolve(value);
        };
      });
    },
    execLimit: msg.timeoutMs === undefined ? 5000 : msg.timeoutMs,
    // Suspension points inside loops, so a runaway loop can be interrupted
    // rather than only detected after the fact.
    killableWhile: true,
    killableFor: true,
    __future__: Sk.python3
  });

  var t0 = Date.now();
  Sk.misceval.asyncToPromise(function () {
    return Sk.importMainWithBody('<stdin>', false, msg.code, true);
  }).then(function () {
    finish(t0, null, inputWaitMs);
  }, function (err) {
    finish(t0, err, inputWaitMs);
  });
}

function finish(t0, err, inputWaitMs) {
  var T = self.__turtle__;
  var timedOut = !!(err && (err instanceof Sk.builtin.TimeLimitError ||
                            (err.tp$name === 'TimeLimitError')));
  postMessage({
    type: 'done',
    stdout: stdout,
    error: err ? describeError(err) : null,
    timedOut: timedOut,
    elapsedMs: Date.now() - t0,
    inputWaitMs: inputWaitMs,
    inputsConsumed: inputsConsumed,
    drawing: T.segments,
    dots: T.dots,
    calls: T.calls,
    lineNumbersSeen: T.lineSeen,
    lineSample: T.segments.length ? T.segments[0].line : null
  });
}

self.onmessage = function (ev) {
  var msg = ev.data;
  if (msg.type === 'run') { run(msg); }
  else if (msg.type === 'input' && pendingInput) { pendingInput(msg.value); }
};
