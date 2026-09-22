// Spike harness — main thread. Drives the worker, records findings, exports a
// Markdown block to paste into docs/SPIKE.md.
'use strict';

var worker = null, ready = null, readyInfo = null, bootMs = null, current = null;
var usableAtMs = null;  // page open → Run usable, captured once (check 6)
var promptsSeen = [];   // what input() actually passed to inputfun, per run
var findings = [];   // {check, item, value}

var $ = function (id) { return document.getElementById(id); };
// `status` is a read-only property of window, so this must not be called that.
var setStatus = function (t) { $('status').textContent = t; };

function boot() {
  var t0 = performance.now();
  worker = new Worker('worker.js');
  ready = new Promise(function (resolve) {
    worker.onmessage = function (ev) {
      var m = ev.data;
      if (m.type === 'ready') {
        bootMs = performance.now() - t0;
        if (usableAtMs === null) { usableAtMs = performance.now(); }
        readyInfo = m;
        setStatus('ready in ' + Math.round(performance.now()) + ' ms from page open');
        resolve(m);
        return;
      }
      if (!current) { return; }
      if (m.type === 'stdout') { current.onStdout(m.chunk); }
      else if (m.type === 'input-request') { current.onInput(m.prompt); }
      else if (m.type === 'done') { var c = current; current = null; c.resolve(m); }
    };
  });
  return ready;
}

function run(code, opts) {
  opts = opts || {};
  return ready.then(function () {
    return new Promise(function (resolve) {
      promptsSeen = [];
      current = {
        resolve: resolve,
        onStdout: function (chunk) { if (opts.out) { append(opts.out, chunk); } },
        onInput: function (prompt) {
          promptsSeen.push(prompt);
          if (opts.out) { askInput(opts.out, prompt); }
          else { worker.postMessage({ type: 'input', value: '' }); }
        }
      };
      worker.postMessage({
        type: 'run', code: code,
        mode: opts.mode || 'headless',
        stdin: opts.stdin || [],
        timeoutMs: opts.timeoutMs === undefined ? 5000 : opts.timeoutMs
      });
    });
  });
}

function append(id, text) { $(id).textContent += text; }
function clear(id) { $(id).textContent = ''; }

// Design brief: a real input line inside the output panel, with a caret, no modal.
function askInput(id, prompt) {
  var panel = $(id);
  // Skulpt hands the prompt to inputfun and does not print it, so the UI owns it.
  if (prompt) { panel.textContent += prompt; }
  var line = document.createElement('span');
  line.className = 'inputline';
  var input = document.createElement('input');
  input.setAttribute('aria-label', prompt || 'input');
  line.appendChild(input);
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
  input.focus();
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') { return; }
    var value = input.value;
    line.remove();
    panel.textContent += value + '\n';
    panel.scrollTop = panel.scrollHeight;
    worker.postMessage({ type: 'input', value: value });
  });
}

function record(check, item, value) {
  findings.push({ check: check, item: item, value: String(value) });
}

function table(id, rows) {
  var html = '<table><tr><th>Item</th><th>Result</th><th>Detail</th></tr>';
  rows.forEach(function (r) {
    var cls = r.state === 'ok' ? 'ok' : (r.state === 'no' ? 'no' : 'wait');
    var mark = r.state === 'ok' ? 'yes' : (r.state === 'no' ? 'NO' : '·');
    html += '<tr><td>' + esc(r.item) + '</td>' +
            '<td class="tag ' + cls + '">' + mark + '</td>' +
            '<td class="v">' + esc(r.detail === undefined ? '' : r.detail) + '</td></tr>';
  });
  $(id).innerHTML = html + '</table>';
}

function esc(s) {
  return String(s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
  });
}

function trim(s) { return String(s).replace(/\s+$/, ''); }

// ---------------------------------------------------------------- check 1 ---

var FEATURES = [
  ['f-strings', 'name = "світ"\nn = 7\nprint(f"Привіт, {name}! {n * 2}")', 'Привіт, світ! 14'],
  ['Cyrillic in strings and output', 'print("Привіт")\nprint(len("їжак"))', 'Привіт\n4'],
  ['dict .items() / .keys()', 'd = {"a": 1, "b": 2}\nfor k, v in d.items():\n    print(k, v)', 'a 1\nb 2'],
  ['enumerate', 'for i, x in enumerate([10, 20, 30]):\n    print(i, x)', '0 10\n1 20\n2 30'],
  ['zip', 'for a, b in zip([10, 20, 30], "abc"):\n    print(a, b)', '10 a\n20 b\n30 c'],
  ['slicing, [::-1]', 'xs = [10, 20, 30]\nprint(xs[1:], xs[::-1])', '[20, 30] [30, 20, 10]'],
  ['split / join', 'print("a,b,c".split(","))\nprint("-".join(["a", "b"]))', "['a', 'b', 'c']\na-b"],
  ['sorted(reverse=)', 'print(sorted([10, 30, 20], reverse=True))', '[30, 20, 10]'],
  ['math', 'import math\nprint(math.sqrt(16), round(math.pi, 2))', '4.0 3.14'],
  ['random', 'import random\nrandom.seed(1)\nx = random.randint(1, 6)\nprint(1 <= x <= 6)', 'True'],
  ['try / except', 'try:\n    int("nope")\nexcept ValueError:\n    print("caught")', 'caught'],
  ['str/int conversion', 'print(abs(-3), int("5") + 1, str(5) + "x")', '3 6 5x'],
  // File-delivery additions (docs/SPIKE.md check 1, "not yet checked" rows).
  // Not previously run — the grade 8 BMI/quadratic-roots projects are the
  // likeliest place a student's file-delivered program hits either of these.
  ['f-string format spec, e.g. f"{x:.2f}"', 'x = 3.14159\nprint(f"{x:.2f}")', '3.14'],
  ['f-string conversion flag, e.g. f"{x!r}"', 'x = "hi"\nprint(f"{x!r}")', "'hi'"]
];

var COMBINED = [
  'name = "світ"', 'n = 7', 'print(f"Привіт, {name}! {n * 2}")', '',
  'd = {"a": 1, "b": 2}', 'for k, v in d.items():', '    print(k, v)',
  'print(list(d.keys()), list(d.values()))', '',
  'xs = [10, 20, 30]', 'for i, x in enumerate(xs):', '    print(i, x)',
  'for a, b in zip(xs, "abc"):', '    print(a, b)', '',
  'print(xs[1:], xs[::-1], sorted(xs, reverse=True))',
  'print("a,b,c".split(","), "-".join(["a", "b"]))',
  'print(max(xs), min(xs), sum(xs), len(xs))', '',
  'import math, random', 'print(math.sqrt(16), round(math.pi, 2))',
  'print(abs(-3), int("5") + 1, str(5) + "x")', '',
  'try:', '    int("nope")', 'except ValueError:', '    print("caught")'
].join('\n');

// File-delivery addition (docs/SPIKE.md check 1, "not yet run"): a file
// written in IDLE can carry a UTF-8 BOM, CRLF line endings, and non-ASCII
// comments together. TASK_SCHEMA.md's upload validation strips the BOM and
// normalizes CRLF -> \n before anything runs; this checks that normalization
// actually happens (raw Skulpt may choke on the BOM) and, more importantly,
// that the reported error line still points at the right source line
// afterward — a shift here would be invisible in every other check, since
// none of them touch a file with mixed encoding and endings.
var BOM = '﻿';
var CRLF_ERROR_LINE = 4;
var CRLF_SOURCE = BOM +
  '# Коментар з BOM\r\n' +
  'print("рядок 2")\r\n' +
  'print("рядок 3")\r\n' +
  'print(undefined_name)\r\n';

function normalizeUpload(src) {
  return src.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function check1() {
  var rows = [];
  clear('o1');
  return FEATURES.reduce(function (chain, f) {
    return chain.then(function () {
      return run(f[1]).then(function (r) {
        var got = trim(r.stdout);
        var ok = !r.error && got === f[2];
        rows.push({
          item: f[0], state: ok ? 'ok' : 'no',
          detail: r.error ? (r.error.type + ': ' + r.error.message)
                          : (ok ? got.split('\n')[0] : 'got ' + JSON.stringify(got) +
                                  ', expected ' + JSON.stringify(f[2]))
        });
        record(1, f[0], ok ? 'works' : (r.error ? r.error.type + ': ' + r.error.message
                                                : 'output ' + JSON.stringify(got)));
        table('t1', rows);
      });
    });
  }, Promise.resolve()).then(function () {
    return run(COMBINED, { out: 'o1' });
  }).then(function (r) {
    if (r.error) { append('o1', '\n[' + r.error.type + '] ' + r.error.message); }
  }).then(function () {
    return run(CRLF_SOURCE);
  }).then(function (raw) {
    rows.push({
      item: 'raw upload, unnormalized (BOM + CRLF, before TASK_SCHEMA.md\'s upload validation)',
      state: raw.error ? 'wait' : 'no',
      detail: raw.error ? (raw.error.type + ' at line ' + raw.error.line + ' — expect this to differ ' +
                            'from the normalized result below; that difference is what normalization fixes')
                        : 'ran with no error — unexpected for a NameError on line ' + CRLF_ERROR_LINE
    });
    record(1, 'raw BOM+CRLF file (unnormalized)',
           raw.error ? raw.error.type + ' at line ' + raw.error.line : 'no error (unexpected)');
    return run(normalizeUpload(CRLF_SOURCE));
  }).then(function (norm) {
    var ok = !!norm.error && norm.error.line === CRLF_ERROR_LINE;
    rows.push({
      item: 'normalized upload (BOM stripped, CRLF→\\n): error line still points at line ' + CRLF_ERROR_LINE,
      state: ok ? 'ok' : 'no',
      detail: norm.error ? (norm.error.type + ' at line ' + norm.error.line +
                            (ok ? '' : ' — WRONG, expected ' + CRLF_ERROR_LINE))
                         : 'ran with no error — unexpected'
    });
    record(1, 'normalized BOM+CRLF file — error line',
           ok ? 'correct: line ' + norm.error.line
              : 'WRONG: ' + (norm.error ? 'line ' + norm.error.line : 'no error') +
                ', expected line ' + CRLF_ERROR_LINE);
    table('t1', rows);
  });
}

// ---------------------------------------------------------------- check 2 ---

var SQUARE = 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)';
var SQUARE_ALT = 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.left(270)';
var PEN = [
  'import turtle', 'turtle.forward(50)', 'turtle.penup()', 'turtle.forward(50)',
  'turtle.pendown()', 'turtle.pencolor("red")', 'turtle.pensize(3)', 'turtle.forward(50)',
  'turtle.circle(20)'
].join('\n');

// Normalization from AI_CONTEXT.md: round to 1 px, order endpoints canonically,
// drop zero-length segments, compare as a set.
function normalize(segments) {
  var seen = {};
  segments.forEach(function (s) {
    var a = [Math.round(s.x1), Math.round(s.y1)], b = [Math.round(s.x2), Math.round(s.y2)];
    if (a[0] === b[0] && a[1] === b[1]) { return; }
    var f = (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? [a, b] : [b, a];
    seen[JSON.stringify(f)] = true;
  });
  return Object.keys(seen).sort();
}

function check2() {
  var rows = [];
  clear('o2');
  return run(SQUARE).then(function (r) {
    rows.push({
      item: 'turtle module replaced before execution',
      state: readyInfo && readyInfo.replaced ? 'ok' : 'no',
      detail: 'src/lib/turtle.js overwritten in Sk.builtinFiles'
    });
    rows.push({
      item: 'stub receives calls', state: r.calls.length ? 'ok' : 'no',
      detail: r.calls.join(', ')
    });
    rows.push({
      item: 'pen state and heading tracked into segments',
      state: r.drawing.length === 4 ? 'ok' : 'no',
      detail: r.drawing.length + ' segments from the square'
    });
    rows.push({
      item: 'source line reachable inside the stub',
      state: r.lineNumbersSeen ? 'ok' : 'no',
      detail: r.lineNumbersSeen ? 'Sk.currLineNo = ' + r.lineSample
                                : 'not reachable — fall back to call order (optional per SPIKE.md)'
    });
    record(2, 'module replaceable', readyInfo && readyInfo.replaced ? 'yes' : 'NO');
    record(2, 'stub receives calls', r.calls.length ? 'yes: ' + r.calls.join(' ') : 'NO');
    record(2, 'segments produced', r.drawing.length + ' for a square');
    record(2, 'line number in stub', r.lineNumbersSeen ? 'yes' : 'no — call order fallback');
    append('o2', 'square segments:\n' + r.drawing.map(function (s) {
      return '  (' + Math.round(s.x1) + ',' + Math.round(s.y1) + ') → (' +
             Math.round(s.x2) + ',' + Math.round(s.y2) + ')  ' + s.color + ' w' + s.width;
    }).join('\n') + '\n');
    var a = normalize(r.drawing);
    return run(SQUARE_ALT).then(function (r2) {
      var b = normalize(r2.drawing);
      var same = JSON.stringify(a) === JSON.stringify(b);
      rows.push({
        item: 'right(90) ≡ left(270) after normalization',
        state: same ? 'ok' : 'no',
        detail: same ? 'identical segment sets' : 'sets differ — comparison design is wrong'
      });
      record(2, 'right(90) ≡ left(270)', same ? 'yes' : 'NO');
      return run(PEN);
    });
  }).then(function (r3) {
    var colors = {};
    r3.drawing.forEach(function (s) { colors[s.color] = true; });
    rows.push({
      item: 'penup / pencolor / pensize / circle',
      state: r3.drawing.length > 2 && colors.red ? 'ok' : 'no',
      detail: r3.drawing.length + ' segments, colors: ' + Object.keys(colors).join(', ')
    });
    record(2, 'pen state / colour / circle', r3.drawing.length + ' segments, colors ' +
           Object.keys(colors).join('+'));
    append('o2', '\npen test: ' + r3.drawing.length + ' segments (gap from penup is absent)\n');
    table('t2', rows);
  });
}

// ---------------------------------------------------------------- check 3 ---

var BMI = 'w = float(input())\nh = float(input())\nprint(w / h ** 2)';
var LOOP_INPUT = [
  'total = 0', 'for i in range(3):', '    x = int(input(f"Число {i + 1}: "))',
  '    total = total + x', '    print("Проміжна сума:", total)', 'print("Разом:", total)'
].join('\n');

function check3() {
  var rows = [];
  clear('o3');
  return run(BMI, { stdin: ['70', '1.75'], out: 'o3' }).then(function (r) {
    var value = parseFloat(trim(r.stdout).split('\n').pop());
    var ok = !r.error && Math.abs(value - 22.857) < 0.01;
    rows.push({
      item: 'headless: stdin queue consumed by input()',
      state: ok ? 'ok' : 'no',
      detail: r.error ? r.error.type + ': ' + r.error.message
                      : value + ' from 2 inputs (' + r.inputsConsumed + ' consumed)'
    });
    rows.push({
      item: 'works without SharedArrayBuffer (no COOP/COEP)',
      state: readyInfo && !readyInfo.crossOriginIsolated ? 'ok' : 'wait',
      detail: 'crossOriginIsolated=' + (readyInfo && readyInfo.crossOriginIsolated) +
              ', SharedArrayBuffer=' + (readyInfo && readyInfo.sharedArrayBuffer)
    });
    record(3, 'headless queue', ok ? 'works, ' + value : 'FAILED');
    record(3, 'without SharedArrayBuffer',
           readyInfo && !readyInfo.crossOriginIsolated
             ? 'yes — not cross-origin isolated, no headers needed' : 'inconclusive');
    table('t3', rows);
  });
}

function check3i() {
  clear('o3');
  setStatus('waiting for you to type three numbers…');
  return run(LOOP_INPUT, { mode: 'interactive', out: 'o3', timeoutMs: 5000 })
    .then(function (r) {
      var prompts = promptsSeen.filter(function (p) { return p; });
      var rows = [{
        item: 'interactive: prompt inside a loop, built from earlier output',
        state: !r.error && !r.timedOut ? 'ok' : 'no',
        detail: r.error ? r.error.type + ': ' + r.error.message
                        : r.inputsConsumed + ' inputs, ' +
                          Math.round(r.inputWaitMs) + ' ms spent waiting'
      }, {
        item: 'Sk.inputfunTakesPrompt honoured — prompt text arrives',
        state: prompts.length === promptsSeen.length && prompts.length ? 'ok' : 'no',
        detail: prompts.length ? prompts.join(' | ') : 'no prompt text reached inputfun'
      }];
      record(3, 'interactive prompt in a loop',
             !r.error && !r.timedOut ? 'works, ' + r.inputsConsumed + ' inputs' : 'FAILED');
      record(3, 'prompt text arrives',
             prompts.length ? 'yes: ' + prompts.join(' / ') : 'NO');
      table('t3', rows);
      setStatus('ready');
    });
}

// ---------------------------------------------------------------- check 4 ---

function check4() {
  var rows = [];
  clear('o4');
  var t0 = performance.now();
  return run('while True:\n    pass', { timeoutMs: 2000 }).then(function (r) {
    var took = performance.now() - t0;
    rows.push({
      item: 'Sk.execLimit stops an infinite loop',
      state: r.timedOut ? 'ok' : 'no',
      detail: (r.timedOut ? 'stopped' : 'did NOT stop') + ' after ' + Math.round(took) +
              ' ms (limit 2000), error: ' + (r.error ? r.error.type : 'none')
    });
    record(4, 'execLimit stops an infinite loop',
           r.timedOut ? 'yes, ' + Math.round(took) + ' ms for a 2000 ms limit' : 'NO');
    append('o4', 'infinite loop: ' + (r.error ? r.error.type + ' — ' + r.error.message : 'no error') + '\n');
    var t1 = performance.now();
    return run('import time\nprint("a")\ntime.sleep(2)\nprint("b")', { timeoutMs: 5000, out: 'o4' })
      .then(function (r2) { return { r2: r2, took: performance.now() - t1 }; });
  }).then(function (o) {
    rows.push({
      item: 'time.sleep suspends rather than blocks',
      state: !o.r2.error && o.took > 1800 ? 'ok' : 'no',
      detail: Math.round(o.took) + ' ms elapsed for sleep(2)' +
              (o.r2.error ? ', error ' + o.r2.error.type : '')
    });
    record(4, 'time.sleep', !o.r2.error ? 'suspends, ' + Math.round(o.took) + ' ms' :
           'FAILED: ' + o.r2.error.type);
    // Hard fallback: kill the worker and time a cold restart.
    var t2 = performance.now();
    worker.terminate();
    current = null;
    boot();
    return ready.then(function () {
      rows.push({
        item: 'Worker.terminate() + restart',
        state: 'ok',
        detail: Math.round(performance.now() - t2) + ' ms to a usable worker'
      });
      record(4, 'terminate + restart', Math.round(performance.now() - t2) + ' ms');
      table('t4', rows);
    });
  });
}

function check4i() {
  clear('o4');
  setStatus('type something — but wait 30 seconds first');
  var t0 = performance.now();
  return run('x = input("Друкуй повільно: ")\nprint(x)',
             { mode: 'interactive', out: 'o4', timeoutMs: 5000 }).then(function (r) {
    var waited = Math.round(r.inputWaitMs / 1000);
    table('t4', [{
      item: 'limit paused across an input suspension',
      state: !r.timedOut && !r.error ? 'ok' : 'no',
      detail: 'waited ' + waited + ' s with a 5 s limit, timedOut=' + r.timedOut
    }]);
    record(4, 'limit paused while waiting for input',
           !r.timedOut ? 'yes — ' + waited + ' s wait, 5 s limit, no timeout' : 'NO — false timeout');
    setStatus('ready');
  });
}

// ---------------------------------------------------------------- check 5 ---

var ERRORS = [
  ['NameError', 'print(x)'],
  ['SyntaxError', 'print("a"'],
  ['str + int — grade 8, rule #1', 'age = input()\nprint(age + 1)']
];

function check5() {
  var rows = [];
  return ERRORS.reduce(function (chain, e) {
    return chain.then(function () {
      return run(e[1], { stdin: ['12'] }).then(function (r) {
        var err = r.error || {};
        rows.push({
          item: e[0],
          state: err.type ? 'ok' : 'no',
          detail: 'type=' + err.type + '  line=' + err.line + '  col=' + err.col +
                  '\nmessage=' + err.message + '\nraw=' + err.raw
        });
        record(5, e[0], 'type=' + err.type + ' line=' + err.line + ' col=' + err.col +
               ' message=' + JSON.stringify(err.message));
        table('t5', rows);
      });
    });
  }, Promise.resolve());
}

// ---------------------------------------------------------------- check 6 ---

function check6() {
  var rows = [{
    item: 'page open → Run usable',
    state: bootMs < 5000 ? 'ok' : 'no',
    detail: Math.round(usableAtMs) + ' ms from page open (' + Math.round(bootMs) +
            ' ms of it the worker) — reload the page for the warm-cache number'
  }];
  record(6, 'page open → Run usable', Math.round(usableAtMs) + ' ms (worker ' +
         Math.round(bootMs) + ' ms)');
  var t0 = performance.now();
  return run('print(1 + 1)').then(function () {
    var trivial = performance.now() - t0;
    rows.push({
      item: 'trivial program', state: trivial < 300 ? 'ok' : 'no',
      detail: Math.round(trivial) + ' ms'
    });
    record(6, 'trivial run', Math.round(trivial) + ' ms');
    table('t6', rows);
    var before = performance.memory ? performance.memory.usedJSHeapSize : null;
    var chain = Promise.resolve();
    for (var i = 0; i < 10; i++) {
      chain = chain.then(function () { return run('xs = [i * i for i in range(1000)]\nprint(len(xs))'); });
    }
    return chain.then(function () { return before; });
  }).then(function (before) {
    var after = performance.memory ? performance.memory.usedJSHeapSize : null;
    rows.push({
      item: 'memory after ten runs',
      state: before === null ? 'wait' : 'ok',
      detail: before === null ? 'performance.memory unavailable (Chrome only)'
        : (before / 1048576).toFixed(1) + ' → ' + (after / 1048576).toFixed(1) + ' MB'
    });
    record(6, 'memory after ten runs', before === null ? 'not measurable in this browser'
      : (before / 1048576).toFixed(1) + ' → ' + (after / 1048576).toFixed(1) + ' MB');
    // 200 segments, drawn the way the app will draw them: from the log, on canvas.
    return run('import turtle\nfor i in range(200):\n    turtle.forward(60)\n    turtle.right(89)');
  }).then(function (r) {
    var t1 = performance.now();
    drawSegments(r.drawing);
    var renderMs = performance.now() - t1;
    rows.push({
      item: 'render ' + r.drawing.length + ' turtle segments',
      state: renderMs < 50 ? 'ok' : 'no',
      detail: Math.round(r.elapsedMs) + ' ms to run, ' + renderMs.toFixed(1) + ' ms to draw'
    });
    record(6, '200 segments', Math.round(r.elapsedMs) + ' ms run, ' +
           renderMs.toFixed(1) + ' ms render');
    table('t6', rows);
  });
}

function drawSegments(segments) {
  var canvas = $('c6'), ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!segments.length) { return; }
  var xs = [], ys = [];
  segments.forEach(function (s) { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2); });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  var pad = 12;
  var scale = Math.min((canvas.width - 2 * pad) / Math.max(1, maxX - minX),
                       (canvas.height - 2 * pad) / Math.max(1, maxY - minY));
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#3E6B63';
  ctx.lineWidth = 1;
  ctx.beginPath();
  segments.forEach(function (s) {
    ctx.moveTo(pad + (s.x1 - minX) * scale, canvas.height - pad - (s.y1 - minY) * scale);
    ctx.lineTo(pad + (s.x2 - minX) * scale, canvas.height - pad - (s.y2 - minY) * scale);
  });
  ctx.stroke();
}

// ---------------------------------------------------------------- check 7 ---

// docs/SPIKE.md check 7: file delivery means turtle code written in Hilka has
// to run unchanged in IDLE, on real CPython's turtle module — not this stub.
// This machine has no CPython for the page itself to call, so this renders a
// comparison table instead of running one: the Hilka column is transcribed
// directly from lib/runner/modules/turtle.ts as shipped, the CPython column
// from the documented stdlib API (docs.python.org/3/library/turtle.html).
// Confirm each row against IDLE on this machine — `import turtle;
// help(turtle.forward)` at the prompt, repeated per function — and record
// what you find; that confirmation, not this table, is what check 7 answers.
//
// [CPython signature, Hilka signature, what to watch for]
var TURTLE_SIGNATURES = [
  ['forward(distance)', 'forward(d)',
   'Name only (positional calls match either way): turtle.forward(100)'],
  ['backward(distance)', 'backward(d)', 'Name only, same as forward'],
  ['left(angle)', 'left(a)', 'Name only, same as forward'],
  ['right(angle)', 'right(a)', 'Name only, same as forward'],
  ['goto(x, y=None)', 'goto(x, y)',
   'CPython also accepts a single (x, y) tuple: turtle.goto((100, 50)). Hilka requires two ' +
   'separate positional numbers — a file using the tuple form fails on Hilka but works in IDLE'],
  ['setheading(to_angle)', 'setheading(a)', 'Name only'],
  ['penup()', 'penup()', 'Match'],
  ['pendown()', 'pendown()', 'Match'],
  ['pencolor(*args)', 'pencolor(c)',
   'CPython also accepts pencolor(r, g, b) or no arguments (returns the current colour). ' +
   'Hilka accepts exactly one colour string and never returns a value'],
  ['pensize(width=None)', 'pensize(w)',
   'CPython with no argument returns the current width. Hilka silently keeps the previous ' +
   'width instead of returning anything'],
  ['circle(radius, extent=None, steps=None)', 'circle(r, extent)',
   'Hilka has no steps parameter — a file calling circle(50, steps=6) to approximate a ' +
   'hexagon behaves differently on Hilka'],
  ['speed(speed=None)', 'speed()',
   'Hilka ignores the argument (nothing is animated) and never returns a value; CPython with ' +
   'no argument returns the current speed'],
  ['home()', 'home()', 'Match'],
  ['dot(size=None, *color)', 'dot(size)',
   'CPython also accepts an inline colour: dot(10, "red"). Hilka has no colour parameter — ' +
   'call pencolor() first instead']
];

function turtleFindingKey(row) { return row[0] + ' vs ' + row[1]; }

function renderTurtleSignatures() {
  var html = '<table><tr><th>CPython (docs.python.org)</th><th>Hilka (lib/runner/modules/turtle.ts)</th>' +
             '<th>What to watch for</th><th>Confirmed on this machine?</th></tr>';
  TURTLE_SIGNATURES.forEach(function (row, i) {
    html += '<tr><td class="v">' + esc(row[0]) + '</td><td class="v">' + esc(row[1]) + '</td>' +
            '<td>' + esc(row[2]) + '</td>' +
            '<td><select data-sig="' + i + '">' +
            '<option value="">not checked yet</option>' +
            '<option value="matches CPython on this machine">matches CPython on this machine</option>' +
            '<option value="the divergence noted is real on this machine">the divergence noted is real on this machine</option>' +
            '<option value="other — see notes">other divergence (see notes)</option>' +
            '</select></td></tr>';
  });
  $('t7').innerHTML = html + '</table>' +
    '<p class="why" style="margin-top:8px">In IDLE on this machine: <code>import turtle; ' +
    'help(turtle.forward)</code>, repeated per function, or Help ▸ Turtle Graphics in the ' +
    'docs. Set each row above as you confirm it — the export picks up your answers.</p>';
}

document.addEventListener('change', function (e) {
  var idx = e.target.getAttribute && e.target.getAttribute('data-sig');
  if (idx === null || idx === undefined) { return; }
  var row = TURTLE_SIGNATURES[Number(idx)];
  record(7, turtleFindingKey(row), e.target.value || 'not checked yet');
});

function check7() {
  renderTurtleSignatures();
  return Promise.resolve();
}

// ------------------------------------------------------------------ wiring ---

var CHECKS = { '1': check1, '2': check2, '3': check3, '3i': check3i,
               '4': check4, '4i': check4i, '5': check5, '6': check6, '7': check7 };

document.addEventListener('click', function (e) {
  var key = e.target.getAttribute && e.target.getAttribute('data-run');
  if (!key) { return; }
  e.target.disabled = true;
  setStatus('running check ' + key + '…');
  Promise.resolve(CHECKS[key]()).then(function () {
    e.target.disabled = false;
    if (key.indexOf('i') === -1) { setStatus('ready'); }
  }, function (err) {
    e.target.disabled = false;
    setStatus('check ' + key + ' threw: ' + err);
  });
});

$('run-all').addEventListener('click', function () {
  var btn = this;
  btn.disabled = true;
  ['1', '2', '3', '4', '5', '6'].reduce(function (chain, k) {
    return chain.then(function () { setStatus('running check ' + k + '…'); return CHECKS[k](); });
  }, Promise.resolve()).then(function () {
    btn.disabled = false;
    setStatus('automatic checks done — now run the two interactive ones and check 7 by hand');
  });
});

$('export').addEventListener('click', function () {
  var lines = ['| Check | Item | Result |', '|---|---|---|'];
  findings.forEach(function (f) {
    lines.push('| ' + f.check + ' | ' + f.item + ' | ' + f.value.replace(/\|/g, '\\|') + ' |');
  });
  lines.push('', 'Browser: ' + navigator.userAgent);
  lines.push('Hardware threads: ' + (navigator.hardwareConcurrency || 'unknown') +
             ', device memory: ' + (navigator.deviceMemory || 'unknown') + ' GB');
  var text = lines.join('\n');
  navigator.clipboard.writeText(text).then(function () {
    setStatus('copied ' + findings.length + ' findings — paste into docs/SPIKE.md');
  }, function () {
    setStatus('clipboard blocked — findings printed to the console');
    console.log(text);
  });
});

boot();
