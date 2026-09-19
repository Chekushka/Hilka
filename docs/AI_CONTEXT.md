# Python Learning Platform — AI Context File

> **Read order for any session:** CLAUDE.md → this file → TASKS.md.
> Read TASK_SCHEMA.md before touching task types, checks, or the authoring UI.
> Read CURRICULUM.md before planning content or the execution layer.
> Update TASKS.md as work progresses. Do not update this file for routine progress —
> only when architecture or conventions actually change.
>
> **Status: under construction.** The spike passed, the runner, checker, error humanization and
> the database layer exist; everything student- and teacher-facing above one practice task does
> not. TASKS.md is the truthful map of what is built. Anything here that no code implements yet
> is a decision, not a description. Unverified assumptions are collected in SPIKE.md.

## What This Project Is

A browser-based platform for teaching Python to school students aged 12–15 (grades 7–9,
Ukrainian curriculum) who are **not motivated to learn programming**. Students solve short
tasks of six kinds, run real Python in the browser, and get non-punitive feedback. Teachers
author tasks in a dashboard, run timed graded sessions, and read results.

Core loop: read a short task → produce an answer (click / drag / type / write code) → run →
see result in ~1 s → advance. The design bet is that *frequency of small wins* matters more
than depth of feedback.

Two use contexts, deliberately different in strictness:
- **Practice** — anonymous. Progress lives in `localStorage`; a student can press save to
  mint a **progress code** and restore it later on any machine. See "Progress Codes".
- **Session** — teacher-created, joined by 6-character code, student picks their name from a
  class roster. Results persist and are gradable. No passwords, no email, no personal data
  beyond a display name the teacher entered.

The interface language is Ukrainian; the codebase, comments, and docs are English.

## Tech Stack

| Tool | Purpose | Note |
|---|---|---|
| Next.js (App Router) + TypeScript | App, API routes, single deploy target | Chosen for AI-assisted development speed, not familiarity |
| Vercel Hobby | Hosting | Free tier is not a constraint at this scale (~25 concurrent users) |
| Neon Postgres | Database | Serverless, cold start ~1 s, does **not** pause permanently on inactivity |
| Drizzle ORM | Schema + queries | Schema-as-TypeScript, migrations checked into repo |
| node-postgres | Database driver | Nothing Neon-specific, so tests and CI run on a plain Postgres. `lib/db/client.ts` is the one place to swap in Neon's HTTP driver if per-request connect cost turns out to matter |
| Skulpt | In-browser Python execution | See "Python Runner" |
| CodeMirror 6 | Code editor | Lighter than Monaco, better low-RAM behaviour |
| Tailwind + CSS custom properties | Styling | Design tokens as CSS vars, Tailwind config maps to them |
| dnd-kit | Parsons drag & drop | Keyboard-accessible drag, unlike most alternatives |

Explicitly **not** used, and why:
- **No ASP.NET Core / Angular.** Reusing the chekuns-dev stack would force two hosts and
  eliminate the single-deploy benefit.
- **No Pyodide** in v1. See "Python Runner".
- **No Skulpt turtle renderer.** The module is stubbed. See "Turtle".
- **No authentication for students.** No accounts, no passwords, no email. Teacher auth only.
- **No server-side Python execution** in v1. See "Cheating and Trust".
- **No offline/PWA support.** Dropped deliberately — the product requires network access.
- **No real-time (WebSocket/SSE) teacher view** in v1. Dashboard polls every 10 s.

## Architecture

Single Next.js app. Three surfaces sharing one data layer:

```
/(student)      practice + session runner   → mostly client components
/(teacher)      dashboard, authoring        → mostly server components
/api            route handlers              → the only place that touches the DB
```

Rules:
- **Only route handlers and server components touch the database.** Client components call
  `/api/*`. No DB access from the runner or editor code.
- **Python never executes on the main thread.** Always inside a Web Worker.
- **Checkers are declarative data, never executable code.** A checker is a JSON object
  interpreted by a shared evaluator, so the same evaluator can run client-side (fast feedback)
  and later server-side (trusted grading) without rewriting anything. Storing JS in the
  database and `eval`-ing it would permanently block server-side verification and is forbidden.
- **The runner is behind an interface.** Nothing outside `lib/runner/` may import Skulpt
  directly, so Pyodide can be swapped in for an advanced track without touching the app.
- **Task content is versioned.** An attempt stores `task_version`, never just `task_id`.
- **Nothing compares student output to a stored picture or a stored expected string produced
  by hand.** Expected results are produced by executing the author's reference solution. See
  "Reference Solutions".

## Folder Map (planned)

```
app/
  (student)/
    practice/            anonymous practice mode
    s/[code]/            session join + task runner
  (teacher)/
    dashboard/           class overview, session monitor
    tasks/               task authoring UI
    sessions/            session builder
  api/
    sessions/            create, join, close
    attempts/            submit, list
    tasks/               CRUD (teacher-only)
    progress/            mint and restore progress codes
    export/              CSV
lib/
  runner/                Python execution — Skulpt worker, module stubs, adapter
                         (the only place importing Skulpt)
  checker/               declarative checker evaluator (isomorphic: client + server)
  errors/                Python error → Ukrainian humanized message
  seed/                  deterministic PRNG + task parameterization
  db/                    Drizzle schema, migrations, queries
components/
  task-types/            one component per task type
  editor/                CodeMirror wrapper, error line marking
  canvas/                turtle canvas renderer + action-log playback
  grid/                  optional 8×8 grid (build only after turtle works)
  meta/                  XP, topic progress, garden
content/
  seed-tasks/            JSON export of tasks, checked into git as backup + handoff format
```

## Database Schema (Drizzle / Postgres)

```
topics
  id, slug, title, order, grade_tags int[], curriculum_ref text, theory_md text

tasks
  id, slug, topic_id, type, title,
  payload jsonb,          -- type-specific, see TASK_SCHEMA.md
  checks jsonb,           -- Check[]
  cases jsonb,            -- RunCase[] | null (input-driven tasks)
  reference jsonb,        -- { code, computedAt, artifacts } | null
  hints jsonb,            -- string[] (ordered, progressively more explicit)
  params jsonb,           -- ParamSpec | null (parameterized variants)
  difficulty smallint,    -- 1..5
  grade_tags int[],
  version int,            -- bumped on publish, not on save
  status text             -- 'draft' | 'published' | 'archived'

teachers
  id, email, role ('teacher' | 'admin'), created_at

teacher_login_tokens
  id, teacher_id, token_hash, expires_at, used_at, created_at

classes
  id, teacher_id, title, roster text[]     -- plain display names, nothing more

sessions
  id, class_id, code char(6), mode ('practice' | 'graded'),
  task_ids uuid[], time_limit_s int | null, hints_enabled bool,
  shuffle bool, opens_at, closes_at

progress_codes
  code char(8) primary key,   -- human-readable alphabet, no 0/O/1/I/l
  state jsonb,                -- completed task ids, xp, current topic
  created_at, updated_at, last_seen_at

attempts
  id, session_id, student_name, task_id, task_version,
  seed bigint, submitted_answer jsonb, passed bool,
  score numeric, hints_used int, duration_ms int,
  flags jsonb,            -- {pasted, edits, tooFast}
  created_at
```

Non-obvious invariants:
- `roster` is a plain array of display names. It is **not** a table of students and must never
  grow into one — the "no registration" constraint depends on this staying trivial.
- `attempts` is append-only. A retry is a new row. "Best attempt" is a query, not an update.
- `sessions.code` is unique only among currently open sessions. Codes are recycled.
- `tasks.version` is bumped on publish. Draft edits are invisible to students — this is what
  makes it safe to edit a task while a class is working.
- `reference.artifacts` is derived, never hand-written. It is recomputed on publish.
- `tasks.slug` exists because task content lives in git as JSON and is imported
  (`npm run db:seed`). A re-import into a fresh database must update the same rows rather than
  duplicate them, and uuids are not stable across databases. `topics.slug` is the same idea.
  It is a content key, not an identifier: foreign keys still use uuids.

## Progress Codes

Practice-mode progress is saved without accounts. First save mints an 8-character code and
writes a `progress_codes` row; entering that code on any machine restores the state.

- `localStorage` stays the primary store. The code is portability and backup — on the same
  machine the student resumes with no code involved.
- Alphabet excludes visually ambiguous characters (`0 O 1 I l`). Displayed grouped
  (`ABCD-EFGH`), accepted case-insensitively, dashes and spaces stripped on input.
- Codes are random, never sequential, and the entry endpoint is rate-limited — an 8-character
  code is a bearer credential for someone else's progress.
- Restoring **merges** rather than replaces: union of completed tasks, maximum of XP. A student
  who practised on two machines must not lose one by entering a code in the wrong order.
- `last_seen_at` exists so abandoned rows can be pruned later. Nothing prunes them yet.

Known weakness, accepted: a lost code is unrecoverable and students in this age group will lose
them. Mitigate in the UI — show the code again on every save, make it copyable, and let a
teacher attach a code to a roster name in the dashboard. The eventual fix is roster-linked
practice progress, after which codes become a fallback rather than the mechanism.

## Teacher Auth

Magic link, no passwords — `~5 accounts total; anything heavier is over-engineering`
(CLAUDE.md). A teacher requests a link for their email; `teacher_login_tokens` stores it
**hashed** and single-use (`used_at`), expiring after 15 minutes. Verifying the token starts a
session that is **not** a database row: `lib/auth/session-cookie.ts` signs
`teacherId.expiresAtMs` with `AUTH_SECRET` (HMAC-SHA256) and reads it back the same way, so
logging in costs one insert and one update, never a session table to prune.

**No email provider is wired up yet.** `POST /api/auth/request-link` logs the link
server-side and, outside a real Vercel deployment (`process.env.VERCEL`), returns it directly
as `devLoginUrl` — this is what lets CI and this project's own Playwright suite exercise login
without an inbox, since both build and `next start` in production mode too, where `NODE_ENV`
alone can't tell a real deployment from a test run. Wiring a real provider is separate,
unbuilt work; when it lands, `devLoginUrl` must go.

Teachers are provisioned directly in the database — there is no self-signup, and
`request-link` responds identically whether or not the email matches a teacher, so it cannot
be used to enumerate accounts.

## Python Runner

**Skulpt, in a Web Worker, behind an adapter.**

```ts
interface PythonRunner {
  run(code: string, opts: {
    mode: 'interactive' | 'headless';
    stdin?: string[];              // headless: queue consumed by input()
    timeoutMs: number;             // default 5000, excludes time spent waiting for input
    randomSeed?: number;           // headless: makes `random` deterministic
    exprs?: string[];              // `expr` check bodies, evaluated after the run
    onStdout?(chunk: string): void;
    onInputRequest?(prompt: string): Promise<string>;   // interactive only
  }): Promise<RunResult>;
}

interface RunResult {
  stdout: string;
  error: PyError | null;     // { type, message, line, col }
  drawing: Segment[];        // turtle output, empty when unused
  actions: GridAction[];     // optional grid API, empty when unused
  timedOut: boolean;
  inputsConsumed: number;
  vars: Record<string, PyValue>;        // module globals after the run — powers var_equals
  exprResults: Record<string, boolean>; // opts.exprs, keyed by their own text — powers expr
}
```

Why Skulpt over Pyodide: ~1.5 MB vs 8–12 MB, which matters on school connections and 4 GB
machines; `input()` is a supported suspension hook; infinite-loop protection is built in
(`Sk.execLimit`). Cost: Skulpt implements a subset of Python, not CPython.

Execution must go through `Sk.misceval.asyncToPromise`, not the synchronous path. Suspensions
are what make `input()`, `time.sleep`, and cooperative timeout handling possible, and they work
inside a Worker over `postMessage` — no `SharedArrayBuffer`, so no COOP/COEP headers on Vercel.

`Sk.execLimit` is wall-clock. It must be **paused while waiting for input**, or a slow typist
gets "your program stopped responding". Same for `time.sleep`.

Module stubs live in `lib/runner/modules/`. `turtle` and `random` are replaced (see below);
`math` and `time` pass through. `time.sleep` must yield a suspension rather than block.

Verification of Skulpt's actual language coverage, turtle behaviour, and input loop is the
first task of the project. See SPIKE.md — everything else assumes it passes.

## Turtle

Turtle is the curriculum's own visual layer — grade 7 is built on it and grade 9 returns to it
(CURRICULUM.md). It is therefore the **primary** visualization, and the invented 8×8 grid world
is optional and secondary.

**Skulpt's turtle renderer is not used.** It draws into a DOM element, which does not exist in
a Worker, and it would put rendering on the wrong side of the runner boundary. Instead
`lib/runner/modules/turtle.ts` provides a stub implementing the same surface
(`forward`, `backward`, `left`, `right`, `goto`, `setheading`, `penup`, `pendown`, `pencolor`,
`pensize`, `circle`, `speed`, `home`, `dot`) that records geometry and draws nothing.

Output is a segment log, pen-down movements only:

```ts
interface Segment { x1: number; y1: number; x2: number; y2: number;
                    color: string; width: number; line: number | null }
```

`line` is the source line that produced the segment, used for playback highlighting. Obtaining
it from the Skulpt frame is **unverified** — if it fails, fall back to call order, which is
equivalent for the linear code grade 7 writes.

**API fidelity is a hard constraint, not a nice-to-have.** File-delivery tasks (see "File
Delivery") mean code written in Hilka must run unchanged in IDLE, on real CPython's real `turtle`
module. The stub's function signatures — `forward`, `backward`, `left`, `right`, `goto`,
`setheading`, `penup`, `pendown`, `pencolor`, `pensize`, `circle`, `speed`, `home`, `dot`, and
their aliases — must match CPython's `turtle` exactly: same names, same parameter order, same
defaults. No convenience functions of the stub's own, however small, because a student who takes
their program home and finds it broken against real turtle has suffered the same trust failure
as being handed a wrong grade. SPIKE.md carries the signature comparison for the functions grade
7 actually uses.

Rendering happens on the main thread from this log. One renderer draws both the student's
result and the target, so they are guaranteed to share scale, theme, and coordinate system.

### Comparison rules

Never compare command logs. `right(90)` and `left(270)` produce identical pictures and
different logs; failing a correct-but-different solution is exactly the event that makes a
reluctant student close the tab.

Normalize before comparing: round coordinates to 1 px, order each segment's endpoints
canonically, drop zero-length segments, and treat the result as a **set**. Check kinds are
`shape_equals`, `shape_contains`, and `shape_props` — specified in TASK_SCHEMA.md.

### On screen

The target renders as a translucent outline **underneath** the student's drawing. Divergence
becomes visible before any message appears — a geometric mistake is seen, not explained.

Because playback comes from our own log, each segment can be tied to its source line and
replayed with a scrubber, highlighting the line as it draws. That covers grade 7 lesson 40
(«покрокове виконання») without an interpreter-level stepper.

## Input

Two execution modes, and the difference is pedagogical rather than technical.

**Run → interactive.** A real input line inside the output panel, with a caret, no modal. The
program blocks, the student types, execution resumes. The grade 8 PyPizza project only makes
sense if the pizza can actually be ordered.

**Check → headless test cases.** The task stores several input sets; the code runs once per
set with `stdin` pre-queued, and each run carries its own checks. That is the same «добір
тестових даних» the grade 9 programme teaches at lesson 37 — encountered a year earlier as
platform mechanics rather than as a dry topic.

### The comparison trap

Exact `stdout` comparison is fatal here. One student writes `print("Введіть вагу:")`, another
writes `input("Вага: ")`, a third prints nothing at all. All three are correct and all three
fail an exact match.

For input-driven tasks, checks ignore prompt text and look only at results: `number_close`,
`numbers_equal`, `last_line_equals`. `stdout_equals` survives only for tasks with no input,
where the required output is stated verbatim in the task text.

### Error rule that matters most

The single most common mistake in grade 8 is arithmetic on the string `input()` returns. The
humanization rule for it must be first in the rule base and must not read like a traceback:

> `input()` завжди дає текст, навіть коли ти ввів число. Щоб рахувати, оберни його:
> `int(input())`.

If `TypeError: can only concatenate str (not "int") to str` reaches a student, half the class
is lost on the first project of the year.

## File Delivery

Grade 8 lesson 43 («Середовища для написання коду. Транслятори») and the grade 9 project lessons
(31–44) require students to work with real `.py` files in a real editor, not a browser sandbox.
The classroom machines have IDLE installed and colleagues already teach with it, so IDLE is the
target — Hilka adapts to IDLE, it does not recommend a replacement (CURRICULUM.md). A
file-delivery task lets a student download a `.py` file, edit it in IDLE, and upload it back to
be checked.

This deliberately breaks the ~1 s feedback loop the rest of the product is built around. That
cost is accepted, not overlooked: the goal of this mode is teaching students to work with files
outside a browser sandbox, which the curriculum requires at these two points and nowhere else.
Every other task stays inline for exactly this reason — file delivery is the exception, not a
new default.

**Sequencing rule.** A file-delivery task may only follow a task on the same concept the student
has already passed in-browser. The humanized error layer (`lib/errors/`) never reaches a student
working in IDLE — IDLE shows CPython's own traceback, unfiltered — so a student meeting a new
concept for the first time inside a file task has no safety net if it goes wrong. The in-browser
task is what teaches the concept; the file task is what teaches working with it outside the
sandbox. The two are not interchangeable and the second must not substitute for the first.

**Engine divergence.** There is no "Skulpt format" — Skulpt executes ordinary `.py` files, the
same bytes IDLE would run. The problem is coverage: Skulpt implements a subset of Python, so code
that runs correctly in IDLE (real CPython) can fail in Hilka, and the reverse is just as bad — a
task that only works because of a Skulpt quirk would fail the same student's file when they take
it home. Automatic rewriting of student code to paper over the gap is rejected outright: checking
code the student did not write destroys trust in the grade. Two stages:

- **v1 — safe subset + compatibility linter.** A documented allow-list of constructs confirmed
  empirically by SPIKE.md (TASK_SCHEMA.md has the list). On upload, the AST is parsed before
  anything runs; a construct outside the list is rejected with a message naming the replacement
  (e.g. `f"{x:.2f}"` → `round(x, 2)`) and stating plainly that this is a limitation of Hilka's
  engine, not a mistake by the student. See TASK_SCHEMA.md's `FILE_UNSUPPORTED`.
- **v2 — server-side CPython, for file tasks only.** The planned completion of this feature, not
  a vague possibility to revisit later — without it the linter is easy to mistake for the final
  design and grow instead of retire. A sandboxed serverless function runs the uploaded file on
  real CPython and returns stdout and program state; the same declarative `Check[]` evaluates the
  result, unchanged. This removes engine divergence entirely, and as a side effect closes the
  devtools-tampering hole in "Cheating and Trust" below for exactly the tasks that are graded —
  a file already went through a real interpreter server-side, so there is nothing left in the
  client to tamper with. The 2–4 s latency this brings (the same cold-start cost already accepted
  elsewhere in "Cheating and Trust") is irrelevant here: the student has already spent minutes in
  IDLE before uploading, not seconds waiting on a Run button.

**Storage.** The uploaded source is stored verbatim in `attempts.submitted_answer`, the same
column every other task type already writes its answer to — a teacher reviewing a session sees
exactly the file the student returned, not a re-serialized approximation of it.

**v1 scope limit.** Single file only. Multi-file projects with local imports (`import` of a
sibling module) are out of scope for v1 — grade 9's project lessons may eventually need this, but
nothing in the curriculum requires it before the file-delivery mode itself exists.

### CPython vs Skulpt

Differences that matter for grades 7–9 file-delivery content. This list is a summary for
orientation, not the source of truth — **SPIKE.md is authoritative**, because "doesn't support
X" and "supports X but reports it differently" lead to different decisions, and only a check that
actually ran the code can tell them apart.

- No filesystem, no `os`, no `sys` — a file-delivery program that tries to read another file or
  inspect `sys.argv` runs in IDLE and fails in Hilka, silently if not caught by the linter.
- Limited standard library — `math` and `random` are covered (SPIKE.md check 1); most of the rest
  is unverified and therefore outside the safe subset by default.
- Built-in types are not subclassable the way CPython allows.
- f-string format specifiers are incomplete (see TASK_SCHEMA.md's replacement table) — the most
  likely divergence in the grade 8 projects specifically, since `f"{x:.2f}"` is a natural way to
  print a computed BMI or price.
- Error message text differs from CPython's (see the Gotchas entry on `str + int`) — irrelevant
  inside Hilka, where `lib/errors/` matches Skulpt's wording, but it means a student cannot use
  Hilka's error message to debug the same program in IDLE, and vice versa.
- Execution is slower than CPython — irrelevant for the short programs this curriculum assigns.

## Reference Solutions

Every task that executes Python stores `reference.code` — the author's correct solution.
On publish, the platform runs it and stores the derived artifacts: expected stdout per case,
expected segment set for turtle, expected variable values.

This matters for three reasons: hand-typed expected values drift from reality; a task whose
reference stops passing after a runner upgrade is caught automatically; and the `fix` task type
needs both a broken and a correct version anyway.

**A publish is rejected if the reference solution does not pass the task's own checks.** This
single rule removes most authoring errors before a class ever sees them.

## Error Humanization

`lib/errors/` maps `PyError` to a Ukrainian message. Rule-based: match on error type plus a
pattern over the message, produce `{ title, explanation, hint, line }`. Falls back to a generic
calm message rather than ever surfacing a raw traceback.

This layer is the highest-value part of the product for the target audience and the one that
decays silently — every unmatched error reaching a student as raw text is a dropout risk. Log
unmatched errors so the rule base grows from real classroom data.

Timeouts are not errors in the student's eyes and must not be phrased as one: the message says
the program did not finish and points at loops, without blame.

## Cheating and Trust

The client-side checker means a student with devtools can mark any task passed. Accepted for
v1, mitigated rather than solved:

1. **Parameterized variants.** `tasks.params` defines placeholder ranges; concrete values are
   derived from `seed = hash(session_id + student_name + task_id)`. Deterministic, so a
   teacher's report reproduces what the student saw, and different at adjacent desks. This
   defeats copying from a neighbour, which is the realistic threat.
2. **Task shuffling** within a graded session.
3. **Behavioural flags** on the attempt: large paste, near-zero edit count, implausibly fast
   submission. The teacher sees a flag and decides. The system never accuses anyone.

Not mitigated: devtools tampering. The intended fix is a serverless function re-running the
declarative checks on final submission only (cold start 2–4 s is acceptable once per task, not
per run). The architecture is already shaped for this — checks are data and the evaluator is
isomorphic. Do not introduce anything that breaks that.

4. **File-delivery tasks add their own threat.** A file is easier to pass around than typed code
   — forwarding a `.py` attachment costs nothing, where copying code by hand at least costs
   effort. Mitigations are the same parameterized-variant mechanism as above (a passed-around
   file still carries the sender's seed, and their output will not match the receiver's task),
   plus storing a hash of the uploaded source per attempt and flagging identical hashes across
   different students in the same session. The flag goes to the teacher, same as every other
   behavioural flag here — the system never accuses anyone, it surfaces a fact and lets a human
   decide. v2 (server-side CPython, "File Delivery" above) closes devtools tampering specifically
   for graded file tasks; it does not address file-sharing, which stays mitigated rather than
   solved.

For parameterized turtle and input tasks, the reference solution is executed per-seed at
publish time only if the parameter space is small; otherwise expected artifacts are computed
on demand and cached.

## Grading

Session score = tasks passed / tasks assigned, adjusted by hints used, mapped to the Ukrainian
12-point scale by a per-session lookup table the teacher can override. The mapping lives in
config, not in code — teachers disagree about it and will want to change it.

## Conventions

- Code, comments, identifiers, commit messages, and all `.md` docs: **English**.
- All user-facing strings: **Ukrainian**, in `messages/uk.json`. No inline Ukrainian in JSX.
  Error-humanization rules and task content are data, not code, and are the exception.
- IDs are UUIDs except `sessions.code` and `progress_codes.code`.
- Design tokens are CSS custom properties defined once; Tailwind config references them. No
  hard-coded hex values in components.
- Every task type implements one shared component interface. Adding a seventh type must not
  require touching the runner, the session flow, or the dashboard.
- Any new check kind is added to TASK_SCHEMA.md in the same commit as its evaluator.

## Gotchas

Fills in from real bugs found in this project. Do not pre-populate with generic advice.
Unverified assumptions live in SPIKE.md until confirmed, then move here if they turn out to be
traps.

**A module stub cannot see the source line.** Skulpt's compiler emits `$currLineNo` as a local
of the compiled function, not as a global, so a JS module such as the turtle stub has no way to
read it; `Sk.currLineNo` is only populated at suspensions. `Segment.line` is therefore always
null in practice and playback highlighting uses call order. Equivalent for the linear code grade
7 writes, but it rules out line highlighting for anything with branches.

**Skulpt's error text is not CPython's.** The grade 8 archetype `input()` + `+ 1` gives
`TypeError: cannot concatenate 'str' and 'int' objects`, where CPython 3 says `can only
concatenate str (not "int") to str`. No shared substring, so the rules in `lib/errors/` match
Skulpt's wording. A future engine swap invalidates the whole rule base, not just its edges.

**Skulpt reports one message for every syntax mistake.** A missing colon, a
line that should be indented, an indent with nothing above it and an unclosed
quote all arrive as `SyntaxError: bad input`. The message cannot distinguish
them, so the rules in `lib/errors/` read the student's own source line to tell
which mistake it was. There is no `IndentationError` type at all.

**`col` is null for SyntaxError.** `traceback[0].lineno` is reliable; `colno` is 0 for runtime
errors and absent for syntax errors. The editor can mark a line, not a column.

**`sslmode=require` does not mean what libpq means by it.** `pg` currently treats
`require`, `prefer` and `verify-ca` as aliases for `verify-full`, and warns on every
connection that `pg` v9 will switch them to libpq semantics, which verify no certificate at
all. Nothing is wrong today, but the upgrade that changes it will silently stop verifying
Neon's certificate unless the connection strings say `verify-full` by then.

**Skulpt does not echo an `input()` prompt.** With `inputfunTakesPrompt = true` the text arrives
at `inputfun`, but nothing writes it to output. The output panel must print the prompt itself,
or the student sees a bare cursor where the question should be.

**A global named `name`, `length`, `for`, `class`, … is stored mangled.** Skulpt's compiler
(`fixReserved` in its `compile.js`) suffixes any Python identifier that collides with a JS
reserved word or an `Object`/`Function` prototype member — `name`, `length`, `constructor`,
`toString`, `for`, `class`, and about seventy others — with `_$rw$` before using it as a
property key, because the compiled module scope is a plain JS object and bare `name` or
`length` would hit the real `Function.prototype`/`Object.prototype` member instead of storing
the student's value. `lib/runner/py-values.ts` reads the finished program's globals for
`var_equals` and strips that suffix (`$` is not a legal character in a Python identifier, so
the strip is always unambiguous) — anyone reading `module.$d` directly for a future check kind
needs the same unmangling, or a task whose reference solution happens to use a variable called
`name` silently reports it as `undefined`.

**A parsons task's checks reference lines by position, not by content.** `payload.lines[i]`'s
index *is* the identifier `order_equals.lines` and `Submission.orderedLines[].index` use —
there is no separate id field. `lib/task/parsons.ts`'s `parsonsPool` extends the same index
space for `distractors`, at `payload.lines.length + i`, specifically so a distractor can never
collide with a real line's index and always fails the length/order comparison in
`evaluate.ts`'s `order_equals` case. Editing `payload.lines` — reordering, inserting, deleting —
without recomputing every check's `lines` array silently breaks a published task; there is no
runtime check for this because the checker only sees `Submission`, never `payload`. The publish
gate (`app/api/tasks/[id]/publish/route.ts`, `parsonsCanonicalSubmission`) does catch it before
anything reaches a student, but a `PATCH` to a draft's checks alone, without touching the
lines, will not.

**`request.url` inside a route handler does not reflect the Host header it was actually sent
to, at least under `next start` in this sandbox.** A request to `http://127.0.0.1:3000/api/x`
and one to `http://localhost:3000/api/x` both report `request.url` as `http://localhost:3000/...`
— confirmed with curl against both hosts. Any route building an absolute URL from it (the
magic-link's `devLoginUrl` in `app/api/auth/request-link/route.ts`, via
`new URL(path, request.url)`) always redirects to the `localhost` origin, so the browser's
teacher-session cookie ends up scoped to `localhost`, never to whatever origin the page was
actually loaded from. Harmless for a normal click-through login — the redirect just carries the
browser there too — but it breaks anything that assumes the *current* page origin matches
`playwright.config.ts`'s `baseURL` (`127.0.0.1`) after logging in: `page.request` always targets
that configured baseURL for a relative path, regardless of where `page.goto` actually navigated,
so a `page.request` call made after login silently drops the cookie and reads back as logged
out. `tests/e2e/task-authoring.spec.ts` uses an in-page `fetch` (via `page.evaluate`) for every
authenticated call instead, the same way the student flow's own `/api/attempts` call already
does — that always matches the page's real current origin.
