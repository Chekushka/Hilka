# Spike — Verify Before Building

Everything in AI_CONTEXT.md assumes Skulpt can do six specific things. None of them is
confirmed. This spike answers all six in one sitting, with no framework, no database, and no
design: a single static HTML page, Skulpt from a local file, a textarea and a button.

Do this before `create-next-app`. A failure here changes the stack, not the styling.

## Rules

- One page, no build step. `index.html` plus the Skulpt files.
- Write findings into the Result column of each check as you go.
- Run the whole page **on the weakest machine in the classroom, on the school network**, not
  only on the dev machine. Two of the six checks are about that machine, not about Skulpt.
- If a check fails, record what the failure looks like before trying a workaround. "Doesn't
  support f-strings" and "supports them but reports a wrong line number" lead to different
  decisions.

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
| f-strings | all grades | |
| dict `.items()` / `.keys()` | grade 9 | |
| `enumerate` / `zip` | grade 9 | |
| slicing, `[::-1]` | grade 9 strings/lists | |
| `split` / `join` | grade 9 lesson 29 | |
| `sorted(reverse=)` | grade 9 lesson 26 | |
| `math`, `random` | grades 8, 9 | |
| `try / except` | grade 9 lesson 36 | |
| Cyrillic in strings and output | everything | |

Cyrillic is on the list deliberately. An engine that mangles «Привіт» in `print` output or in a
string literal is unusable regardless of everything else, and it is the cheapest thing to check.

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
| Can the `turtle` module be replaced before execution? | |
| Does the stub receive `forward`/`right`/`penup`/`pendown`/`pencolor`/`circle`? | |
| Can pen state and heading be tracked to produce segments? | |
| Is the source line number reachable from inside the stub call? | |

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
| Does `Sk.inputfun` returning a Promise work under `asyncToPromise`? | |
| Does it work with the interpreter inside a Web Worker (postMessage round-trip)? | |
| Is `Sk.inputfunTakesPrompt = true` honoured — does the prompt text arrive? | |
| Does it work with a prompt built from earlier output, inside a loop? | |
| Does it work **without** SharedArrayBuffer (so no COOP/COEP headers)? | |

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
| Does `Sk.execLimit` stop an infinite loop? | |
| Can the limit be paused around an input suspension? | |
| Does `Worker.terminate()` work as a hard fallback, and how long does restart take? | |
| Does `time.sleep` suspend rather than block? | |

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
| Is the error type recoverable as a string? | |
| Is the line number correct and 1-based? | |
| Is the column available? | |
| Do Skulpt messages differ enough from CPython that the rule base must match on Skulpt text? | |

The third snippet is the most common mistake of grade 8. Record its exact message — it becomes
rule number one in `lib/errors/`.

### 6. The classroom machine

| Measurement | Target | Result |
|---|---|---|
| Time from page open to "Run" being usable, cold cache, school network | < 5 s | |
| Same, warm cache | < 1 s | |
| Time to run a trivial program | < 300 ms | |
| Memory after ten runs (does it grow?) | stable | |
| Behaviour with two browser tabs open | usable | |
| Rendering 200 turtle segments on canvas | no visible lag | |

If cold load is far over target, the loading state the design brief asks for stops being a
nicety and becomes the difference between a working lesson and twenty students pressing F5.

## Decision gates

| Outcome | Action |
|---|---|
| All six pass | Proceed. Runner adapter first, then checker. |
| Language gaps only in grade 9 features (`zip`, dict methods) | Proceed. Grade 7 content is unaffected and ships first; revisit before grade 9 content. |
| Turtle stub not interceptable | Serious. Evaluate Pyodide with a hand-written turtle module, and expect the grid world to come back as the primary visual. |
| Interactive input needs SharedArrayBuffer | Add COOP/COEP headers on Vercel and re-test, or fall back to queued input only and accept that PyPizza is less satisfying. |
| Cold load > 15 s on the classroom machine | Reconsider hosting the assets locally in the school, or drop to a lighter engine for the console-only grade 8 track. |

Record the outcome at the top of TASKS.md and check off the matching open questions.
