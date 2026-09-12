# Spike harness

Answers the six checks in `docs/SPIKE.md`. No framework, no build step — open
`index.html` over HTTP and press a button.

| File | What it is |
|---|---|
| `index.html` | The page. One section per check. |
| `spike.js` | Main thread: drives the worker, records findings, exports Markdown. |
| `worker.js` | The only place Python runs. Configures Skulpt, owns the timeout and `input()`. |
| `turtle-stub.js` | Recording turtle module, injected over `src/lib/turtle.js` before execution. |
| `vendor/` | Skulpt 1.2.0, vendored so the load time measured is the load time shipped. |

## Running it

Published to GitHub Pages on every push to `main` that touches `spike/`. Open the
URL **on the weakest machine in the classroom, on the school network** — checks 1–5
are properties of the engine, but check 6 is about that machine and cannot be
measured anywhere else.

1. *Run automatic checks* — checks 1, 2, 3 (headless), 4, 5, 6.
2. *Run interactive* in check 3 — type three numbers.
3. *Run slow-typing test* in check 4 — wait 30 seconds before typing. It must not
   time out. This is the false positive that would hurt the slowest student in the room.
4. *Copy results as Markdown* and paste into check 6 of `docs/SPIKE.md`.

Locally: `python3 -m http.server` from this directory, then open the printed URL.
Opening `index.html` as a `file://` URL does not work — the worker and the stub
fetch need HTTP.

## Not the application

This directory is deliberately outside the app: no framework, no TypeScript, no
imports from `lib/`. It exists to answer questions, and the answers get ported —
`turtle-stub.js` into `lib/runner/modules/`, the worker's timeout and input
handling into the Skulpt adapter. Do not grow it into a second runner.
