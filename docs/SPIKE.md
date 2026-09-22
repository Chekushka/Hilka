# Spike — Verify Before Building

Everything in AI_CONTEXT.md assumes Skulpt can do six specific things. None of them is
confirmed. This spike answers all six in one sitting, with no framework, no database, and no
design: a single static HTML page, Skulpt from a local file, a textarea and a button.

Do this before `create-next-app`. A failure here changes the stack, not the styling.

## Outcome

**All six pass, on the classroom machine.** Checks 1–5 are properties of the engine and hold
anywhere; check 6 was measured on the school machine itself and every measured target is met.
Skulpt stays, the stack is unchanged, and no decision gate was triggered.

The classroom run also settled check 4's worst case with a real person: a **53-second** pause
before typing, against a 5-second execution limit, produced no timeout.

Harness: `spike/`, published to GitHub Pages by `.github/workflows/spike-pages.yml`. Re-run it
there after any runner change.

Three findings that changed something, now in the Gotchas of AI_CONTEXT.md: the source line is
not reachable from inside a module stub, Skulpt's `str + int` message differs from CPython's, and
Skulpt does not echo an `input()` prompt to output.

**File delivery added open items.** Three of the four are done: check 1's f-string format-spec
and conversion-flag rows, and the BOM/CRLF/line-number check, all ran clean (results above) —
these are engine and normalization-logic properties, so a dev-machine run answers them the same
way it would anywhere. What is still open is check 7, comparing the turtle stub's signatures
against real CPython's — that one genuinely needs a real Python interpreter (IDLE) on the actual
classroom machine to compare against, which nothing running inside this page can substitute for.
The harness now renders the comparison table and records the answer; someone still has to sit at
the machine and check each row. None of the original six checks changed; these are additions for
the file-delivery mode (AI_CONTEXT.md, TASK_SCHEMA.md), and check 7 must be run and recorded
before that mode's safe subset can be trusted.

## Rules

- One page, no build step. `index.html` plus the Skulpt files.
- Write findings into the Result column of each check as you go.
- Run the whole page **on the weakest machine in the classroom, on the school network**, not
  only on the dev machine. Two of the six checks are about that machine, not about Skulpt.
- If a check fails, record what the failure looks like before trying a workaround. "Doesn't
  support f-strings" and "supports them but reports a wrong line number" lead to different
  decisions.
- Check 1's results define the file-delivery safe subset (TASK_SCHEMA.md). Record them precisely
  enough to be copied there verbatim — "mostly works" is not precise enough to allow-list a
  construct that gates whether a student's upload is accepted or rejected.

## Checks

### 1. Language coverage

Run this and record what breaks:

```python
name = "світ"
n = 7
print(f"Привіт, {name}! {n * 2}")

d = {"a": 1, "b": 2}
for k, v in d.items():
    print(k, v)
print(list(d.keys()), list(d.values()))

xs = [10, 20, 30]
for i, x in enumerate(xs):
    print(i, x)
for a, b in zip(xs, "abc"):
    print(a, b)

print(xs[1:], xs[::-1], sorted(xs, reverse=True))
print("a,b,c".split(","), "-".join(["a", "b"]))
print(max(xs), min(xs), sum(xs), len(xs))

import math, random
print(math.sqrt(16), round(math.pi, 2))
print(abs(-3), int("5") + 1, str(5) + "x")

try:
    int("nope")
except ValueError:
    print("caught")
```

| Feature | Needed for | Result |
|---|---|---|
| f-strings | all grades | Works. `f"Привіт, {name}! {n * 2}"` → `Привіт, світ! 14` |
| dict `.items()` / `.keys()` | grade 9 | Works, including `list(d.keys())` |
| `enumerate` / `zip` | grade 9 | Both work |
| slicing, `[::-1]` | grade 9 strings/lists | Works |
| `split` / `join` | grade 9 lesson 29 | Works |
| `sorted(reverse=)` | grade 9 lesson 26 | Works |
| `math`, `random` | grades 8, 9 | Work. `math.sqrt(16)` → `4.0`, `round(math.pi, 2)` → `3.14` |
| `try / except` | grade 9 lesson 36 | Works |
| Cyrillic in strings and output | everything | Works in literals, `print`, f-strings, `len`, and `input()` prompts |
| f-string format specifiers, e.g. `f"{x:.2f}"` | grade 8 projects (BMI, quadratic roots) via file delivery | **Works.** `x = 3.14159; f"{x:.2f}"` → `3.14`. Only `.2f` was tested — the exact form the BMI/price use case needs — not the rest of CPython's format-spec mini-language (padding, alignment, `,`, `%`, …) |
| f-string conversion flags, e.g. `f"{x!r}"` | same | **Works.** `x = "hi"; f"{x!r}"` → `'hi'`, matching CPython's `repr()` quoting |

Cyrillic is on the list deliberately. An engine that mangles «Привіт» in `print` output or in a
string literal is unusable regardless of everything else, and it is the cheapest thing to check.

**File-delivery addition — done.** Parsed a `.py` source containing a UTF-8 BOM, CRLF line
endings, and Ukrainian comments together, both raw and after the normalization TASK_SCHEMA.md's
upload validation is specified to perform (BOM stripped, CRLF → `\n`), with a `NameError` planted
on a known line (line 4) to check the reported line number against.

| Question | Result |
|---|---|
| Does the raw file (BOM + CRLF, unnormalized) parse at all? | **No.** `SyntaxError` at line 1 — the BOM breaks Skulpt's parse before it reaches the real error. This is exactly why normalization has to run before anything else touches the source |
| After normalization, does the error still land on the right line? | **Yes.** `NameError` at line 4, precisely — normalization does not shift line numbers |

A line-ending or BOM bug that only shifts line numbers would have been invisible in every other
check here, since none of them touch a file with mixed encoding and endings — it would have
surfaced for the first time as a student's IDLE-written file reporting an error on the wrong
line. This checks Skulpt's own parsing behaviour and the normalization logic as specified; the
actual upload endpoint (TASKS.md, "Upload endpoint + validation pipeline") is not built yet.

### 2. Turtle as a stub

Do **not** use Skulpt's turtle renderer. Replace the module with a stub that records calls and
draws nothing, and confirm the recording works:

```python
import turtle
for i in range(4):
    turtle.forward(100)
    turtle.right(90)
```

| Question | Result |
|---|---|
| Can the `turtle` module be replaced before execution? | Yes. `Sk.builtinFiles.files['src/lib/turtle.js']` is a plain key; overwrite it before `Sk.configure` and the stub is what `import turtle` gets |
| Does the stub receive `forward`/`right`/`penup`/`pendown`/`pencolor`/`circle`? | Yes, all of them, plus the aliases (`fd`, `rt`, `pu`…) and `turtle.Turtle()` |
| Can pen state and heading be tracked to produce segments? | Yes. The square produces exactly 4 segments; `penup` correctly leaves a gap |
| Is the source line number reachable from inside the stub call? | **No.** The compiler emits `$currLineNo` as a *local* of the compiled function, not a global, so a JS module cannot read it. `Sk.currLineNo` is only set at suspensions. Falling back to call order, as SPIKE.md allows |

The line number is the only optional one — without it, playback highlighting falls back to call
order, which is equivalent for linear grade 7 code. Everything else is required.

### 3. `input()` in a Worker

Two modes, both required.

Headless (queue):
```python
w = float(input())
h = float(input())
print(w / h ** 2)
```

Interactive (prompt inside a loop, output depending on earlier input):
```python
total = 0
for i in range(3):
    x = int(input(f"Число {i + 1}: "))
    total = total + x
    print("Проміжна сума:", total)
print("Разом:", total)
```

| Question | Result |
|---|---|
| Does `Sk.inputfun` returning a Promise work under `asyncToPromise`? | Yes |
| Does it work with the interpreter inside a Web Worker (postMessage round-trip)? | Yes |
| Is `Sk.inputfunTakesPrompt = true` honoured — does the prompt text arrive? | Yes: `Число 1: `, `Число 2: `, `Число 3: ` arrived intact. But Skulpt does **not** echo the prompt to output — the UI must print it |
| Does it work with a prompt built from earlier output, inside a loop? | Yes. The three-iteration loop ran with interleaved output and f-string prompts |
| Does it work **without** SharedArrayBuffer (so no COOP/COEP headers)? | **Yes.** Verified with `crossOriginIsolated=false` and `SharedArrayBuffer` undefined. No COOP/COEP headers needed on Vercel, so embeds stay possible |

The last row is the one that can force a hosting change. If interactive input turns out to need
`SharedArrayBuffer`, Vercel needs COOP/COEP headers, which breaks any third-party embed and
needs checking before it is relied on.

### 4. Timeout that survives waiting

```python
while True:
    pass
```

must stop cleanly and report a timeout. Then:

```python
x = input("Друкуй повільно: ")
print(x)
```

must **not** time out when the student takes 30 seconds to type.

| Question | Result |
|---|---|
| Does `Sk.execLimit` stop an infinite loop? | Yes. `while True: pass` stopped at 2011 ms against a 2 s limit, raising `TimeLimitError` («Program exceeded run time limit.») |
| Can the limit be paused around an input suspension? | Yes. Push `Sk.execStart` forward by the time waited when input resolves. Verified on the classroom machine: **53 s** before typing, against a 5 s limit, no timeout |
| Does `Worker.terminate()` work as a hard fallback, and how long does restart take? | Yes. 81 ms to a usable worker on the classroom machine |
| Does `time.sleep` suspend rather than block? | Yes. `sleep(2)` took 2013 ms and output before and after it arrived normally |

A timer that counts typing time as execution time will produce "your program stopped
responding" for the slowest student in the room. That is the worst possible false positive for
this audience.

### 5. Error shape

```python
print(x)
```
```python
print("a"
```
```python
age = input()
print(age + 1)
```

| Question | Result |
|---|---|
| Is the error type recoverable as a string? | Yes, via `e.tp$name`: `NameError`, `SyntaxError`, `TypeError`, `TimeLimitError` |
| Is the line number correct and 1-based? | Yes, from `e.traceback[0].lineno` |
| Is the column available? | Sometimes. `colno` is 0 for runtime errors and **null for SyntaxError** — do not rely on it for the caret |
| Do Skulpt messages differ enough from CPython that the rule base must match on Skulpt text? | **Yes.** See below |

The third snippet is the most common mistake of grade 8. Its exact Skulpt message, which is what
rule #1 in `lib/errors/` must match on:

```
TypeError: cannot concatenate 'str' and 'int' objects
```

CPython 3 says `can only concatenate str (not "int") to str`. They share no matchable substring,
so the rule base matches Skulpt text, not CPython text. The other two:

```
NameError: name 'x' is not defined          line 1, col 0
SyntaxError: EOF in multi-line statement    line 2, col null
```

### 6. The classroom machine

Measured on the classroom machine. Dev-machine numbers in brackets for comparison.

| Measurement | Target | Result |
|---|---|---|
| Time from page open to "Run" being usable, cold cache, school network | < 5 s | **2214 ms**, of which 80 ms is the worker — the rest is fetching 945 KB of engine *(dev: 107 ms)* |
| Same, warm cache | < 1 s | not recorded |
| Time to run a trivial program | < 300 ms | **2 ms** *(dev: 2–13 ms)* |
| Memory after ten runs (does it grow?) | stable | **0.8 → 0.8 MB**, flat *(dev: 2.7 → 2.7 MB)* |
| Behaviour with two browser tabs open | usable | not recorded |
| Rendering 200 turtle segments on canvas | no visible lag | **11 ms to run, 1.6 ms to draw** *(dev: 6 / 2.6 ms)* |

Every target that was measured is met, most by an order of magnitude. The one number that is
not negligible is the cold load: 2.2 s, and essentially all of it is transferring the engine.
That is well inside the 5 s target but far too long to leave a blank panel, which is what the
loading state in the design brief is for. It is also the number that will degrade first when
twenty-five machines fetch the same 945 KB at the same moment at the start of a lesson.

Vendored engine weight, which is what the school network actually pays for: `skulpt.min.js`
547 KB + `skulpt-stdlib.js` 398 KB = 945 KB uncompressed, ~136 KB gzipped for the engine.

If cold load is far over target, the loading state the design brief asks for stops being a
nicety and becomes the difference between a working lesson and twenty students pressing F5.

### 7. Turtle stub vs CPython signatures (file delivery)

**Harness ready; not yet run on a real machine.** For every function the stub in
`lib/runner/modules/turtle.ts` implements (`forward`, `backward`, `left`, `right`, `goto`,
`setheading`, `penup`, `pendown`, `pencolor`, `pensize`, `circle`, `speed`, `home`, `dot`, and
their short aliases), compare name, parameter order, and defaults against real CPython's `turtle`
module for the functions grade 7 actually uses. Record any divergence found — do not assume a
match because the names line up.

This is the one check nothing in this page can answer by itself — there is no CPython here to
call, only Skulpt. `spike/`'s check 7 instead renders a comparison table: Hilka's side
transcribed straight from `lib/runner/modules/turtle.ts`, CPython's side from the documented
stdlib API, and a per-row dropdown to record what you find comparing against real CPython
(`import turtle; help(turtle.forward)` in IDLE, repeated per function) on the classroom machine
itself. Four divergences are flagged for confirmation already, based on the documented CPython
API rather than a run on this exact machine — **treat these as things to verify, not settled
facts**, until someone actually checks them there:

- `goto(x, y)` — CPython also accepts a single `(x, y)` tuple; the stub requires two separate
  arguments.
- `pencolor(c)` — CPython also accepts `pencolor(r, g, b)` or no arguments (returns the current
  colour); the stub takes exactly one colour string and returns nothing.
- `pensize(w)` — CPython with no argument returns the current width; the stub has no return.
- `circle(r, extent)` — CPython also takes a `steps` parameter to approximate a regular polygon;
  the stub has no equivalent.

This exists because file delivery means turtle code written in Hilka has to run unchanged in
IDLE, on real `turtle`, not the stub. AI_CONTEXT.md's "Turtle" section states the constraint;
this check is what verifies it holds.

## Decision gates

**Outcome: all six pass; the first row applies.** No gate was triggered — no Pyodide evaluation,
no COOP/COEP headers, no lighter engine for grade 8, no return of the grid world.

| Outcome | Action |
|---|---|
| All six pass | Proceed. Runner adapter first, then checker. |
| Language gaps only in grade 9 features (`zip`, dict methods) | Proceed. Grade 7 content is unaffected and ships first; revisit before grade 9 content. |
| Turtle stub not interceptable | Serious. Evaluate Pyodide with a hand-written turtle module, and expect the grid world to come back as the primary visual. |
| Interactive input needs SharedArrayBuffer | Add COOP/COEP headers on Vercel and re-test, or fall back to queued input only and accept that PyPizza is less satisfying. |
| Cold load > 15 s on the classroom machine | Reconsider hosting the assets locally in the school, or drop to a lighter engine for the console-only grade 8 track. |

Record the outcome at the top of TASKS.md and check off the matching open questions.
