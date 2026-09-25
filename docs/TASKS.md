# TASKS

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Fully implemented, no TODOs remaining |
| 🔶 | Partial — some parts done, some still TODO |
| ❌ | Not started |

## Spike (do this before anything else) — see SPIKE.md

Six checks, one static HTML page, no framework. Harness in `spike/`, findings in SPIKE.md.

**Outcome: all six pass, verified on the classroom machine.** Skulpt stays the engine, the
stack is unchanged, and no decision gate was triggered. Cold load there is 2.2 s, nearly all of
it fetching the 945 KB engine — inside target, but it makes the loading state mandatory rather
than decorative.

| Item | Status | Notes |
|---|---|---|
| 1. Language coverage | ✅ | Everything the curriculum needs works, Cyrillic included |
| 2. Turtle module replaceable by a recording stub | ✅ | Replaceable via `Sk.builtinFiles.files`. Source line is **not** reachable — call-order fallback |
| 3. `input()` in a Worker, queued and interactive | ✅ | Both modes work. **No SharedArrayBuffer**, so no COOP/COEP headers |
| 4. Timeout that pauses while waiting for input | ✅ | Push `Sk.execStart` forward by the wait. 53 s before typing against a 5 s limit, no timeout |
| 5. Error shape — type, line, column, message text | ✅ | Type and line reliable; `col` is null for SyntaxError. Skulpt text ≠ CPython text |
| 6. Classroom machine: cold load, memory, 200 segments | ✅ | 2214 ms cold, 2 ms trivial run, memory flat, 200 segments in 11 ms. Warm-cache and two-tab rows still blank |

## Infrastructure

| Item | Status | Notes |
|---|---|---|
| Next.js + TypeScript scaffold | ✅ | Next 16, React 19, Tailwind v4, TS strict, no `src/` — folder map as in AI_CONTEXT.md |
| Vercel project + preview deploys | ✅ | Live at <https://hilka.vercel.app>, production branch `main`, functions in `fra1`. Settings and their failure modes in CI_CD.md §5 |
| Neon database + connection | ✅ | Frankfurt (eu-central-1), migrated and seeded; `DATABASE_URL` injected into Vercel by the Neon integration. `/practice` serves the square from it |
| Drizzle schema + first migration | ✅ | `lib/db/schema.ts`, `drizzle/0000_initial_schema.sql`. All seven tables; `tasks.slug` added so content in git has a stable key |
| Design tokens as CSS vars + Tailwind mapping | ✅ | Both themes in `app/globals.css`, mapped through Tailwind v4 `@theme`. Lifted from the mockups |

## CI/CD and Remote Development

See CI_CD.md. Phases A and B are live — CI on every PR, deploys to Vercel against Neon,
Pages serving the spike, branch protection on `main`, and the `production` environment
`migrate.yml` gates on.

| Item | Status | Notes |
|---|---|---|
| Docs in the repository | ✅ | A cloud session clones the repo; without these it starts blind |
| Cloud environment for remote sessions | 🔶 | Sessions run, but the network policy blocks `*.vercel.app` and `*.neon.tech`: an agent can neither open a deploy nor reach the database, and has to ask a human what the live site shows |
| `SessionStart` hook + permission allowlist | ✅ | `.claude/settings.json`; no-op until `package.json` exists |
| Guardrail script + workflow | ✅ | CLAUDE.md rules 1, 3, 4 and the convention rules, as checks |
| GitHub Pages deploy of `spike/` | ✅ | Pages source switched on; the `spike` workflow has deployed it successfully on every push to `main` since |
| Spike harness itself | ✅ | `spike/` — six checks, Skulpt vendored, turtle stub, interactive input |
| Branch protection on `main` | ✅ | Ruleset at `.github/rulesets/main.json` imported into repo settings |
| `ci.yml` — typecheck, lint, tests | ✅ | Live, with the migration-drift step. The browser job runs a Postgres service, migrates and seeds — the workspace reads its task from the database |
| `migrate.yml` — Drizzle on merge | ✅ | Moved from `.github/workflows-pending/` into `.github/workflows/` (it had been marked ✅ while still parked, so nothing ran). Runs `npm run db:migrate` on a push to `main` touching `drizzle/`, `lib/db/schema.ts` or the workflow itself, and on demand; gated by the `production` environment, whose `DATABASE_URL` must be the unpooled string. Content is still seeded by hand — CI_CD.md step 4 |
| `reference-check.yml` — references vs their own checks | ✅ | Live. `npm run verify:references` drives the real runner via `/runner` (no database needed) against `content/seed-tasks/*.json` |
| Vercel Git integration + preview deploys | ✅ | Installed; PR #7 carried its check. **Deployment Protection is on**, so a logged-out classroom machine cannot open a preview until Vercel Authentication is off or a sharable link is used — CI_CD.md §5 |
| Neon branch-per-preview | 🔶 | Integration installed. Unverified: that *"create a branch for each preview deployment"* is on and a PR preview really gets its own branch |

## Python Runner

| Item | Status | Notes |
|---|---|---|
| `PythonRunner` interface | ✅ | `lib/runner/types.ts`. Guardrail check enforces the boundary |
| Skulpt worker adapter | ✅ | `lib/runner/skulpt-runner.ts` + `worker.ts`. Timeout, cancel, stdout streaming |
| Interactive input line in the output panel | ✅ | `components/task/OutputPanel.tsx`, shared by `code`/`fix`/`fill`. Plain Run now uses `mode: 'interactive'` (`lib/task/use-task-runner.ts`); stdout streams in via `onStdout` and an `input()` call opens a live answer field showing the exact string passed to `input(...)`, wired through `pendingInputPrompt`/`submitInput`. Check stays `'headless'`, unaffected. `tests/e2e/practice.spec.ts` covers it. Check itself still can't pass a console task that calls `input()` — see `code`, below |
| Headless run with queued `stdin` per case | ✅ | `mode: 'headless'` with `stdin[]`; integration test covers it |
| Timeout paused across input suspensions | ✅ | `Sk.execStart` pushed forward by the wait; test covers a 2.5 s answer against a shorter limit |
| `turtle` module stub (records, draws nothing) | ✅ | `lib/runner/modules/turtle.ts`. API fidelity against real CPython `turtle` is now a hard constraint, not just a convenience match — file-delivery code must run unchanged in IDLE (AI_CONTEXT.md, "Turtle"). Signature comparison is SPIKE.md check 7: all 14 functions match CPython. The stub accepts a subset of some CPython call forms (`goto((x, y))`, `pencolor(r, g, b)`, `circle(r, steps=n)` are CPython-only) — harmless in the Hilka → IDLE direction, a linter item only if an uploaded file uses turtle. **Fixed**: `turtle.goto` raised `AttributeError` — `goto` is a JS reserved word, so Skulpt looks it up under a mangled key (AI_CONTEXT.md, Gotchas). The stub now registers every reserved name under both keys; `tests/runner/runner.spec.ts` covers `goto` on the module and on `Turtle()` |
| Segment log + source-line attribution | ✅ | Segment log works; `line` is always null by design, playback uses call order |
| Canvas renderer (student + translucent target, one renderer) | ✅ | `components/canvas/TurtleCanvas.tsx`. One transform for both drawings |
| Playback scrubber with line highlighting | ✅ | `components/canvas/PlaybackScrubber.tsx` + `lib/canvas/playback.ts`. `Segment.line` is always null, so stepping is driven by position in the segment array (call order), highlighting the last-drawn segment on `TurtleCanvas` rather than a source line. Wired into `code`, `fix`, `fill`. Covers grade 7 lesson 40 without an interpreter stepper |
| `random` module stub with deterministic seeding in headless mode | ✅ | `lib/runner/modules/random.ts`. Seeded in headless, genuinely random in interactive |
| Grid API (`move`/`turn`/`take`) + action log | ❌ | Optional, after turtle, only if still justified |

## Checker

| Item | Status | Notes |
|---|---|---|
| Declarative check evaluator | ✅ | `lib/checker/`. Pure, no DOM, no Python — moves to the server unchanged |
| Check kinds: choice/text/order | ✅ | |
| Check kinds: stdout/var/expr | ✅ | `var_equals` reads `RunResult.vars` (module globals after a clean run); `expr` reads `RunResult.exprResults`, evaluated in-worker right after the program via `lib/runner/modules/expr-recorder.ts` |
| Check kinds: `shape_equals` / `shape_contains` / `shape_props` | ✅ | Normalized segment sets, with translate/rotate/scale. Equivalence tested at both runner and checker level |
| Check kinds: `number_close` / `numbers_equal` / `last_line_equals` | ✅ | Prompt text ignored; a decimal comma reads as a decimal point |
| Check kinds: `uses` / `forbids` (AST-based) | ✅ | `lib/checker/ast.ts` — a Python tokenizer, not a full parser. Skips string/comment contents; tracks dotted attribute chains (`turtle.forward`) |
| Reference-solution execution + artifact computation | ✅ | `lib/checker/reference-check.ts`: `checkTaskReference` + `npm run verify:references` prove every seed task's reference solution passes its own checks in CI; `evaluateAgainstOwnRun` is the same evaluation reused by `POST /api/tasks/[id]/publish` as the real publish gate, run against a browser-computed run since there is no server-side Python (AI_CONTEXT.md) |
| `stdout_equals` blocked on tasks with cases | ✅ | `validateTaskChecks` — the authoring UI calls it rather than restating the rule |
| Parameterized variants + seeded PRNG | 🔶 | `lib/seed/` — `deriveSeed` (`hash(sessionId + studentName + taskId)`, FNV-1a), `createRng` (mulberry32, same generator `lib/runner/modules/random.ts` already seeds Python's `random` with), and `lib/seed/params.ts`'s `resolveParams`/`enumerateParamCombinations`/`substituteParams` for `ParamSpec` (`int`/`choice`/`float`+`step`). Pure and unit-tested — the same seed always resolves the same variant. Wired into `code` tasks only, session-only: `GET /api/sessions/[code]/tasks/[taskId]` (`?student=`) substitutes every `{name}` placeholder server-side via `lib/task/params.ts`'s `resolveTaskParams` before the response ever reaches a browser, validated against the session roster first — `/practice` has no student identity, so a parameterized task must only be assigned to a session. `lib/checker/reference-check.ts`'s `checkTaskReference` (and so `npm run verify:references`) now enumerates and runs *every* param combination, not a sampled one. `content/seed-tasks/grade7-code-turtle-star-variant.json` is the worked example (a five-point star, `side` one of four choices); `tests/e2e/parameterized.spec.ts` proves determinism, the roster check, and correct grading through a real session. **Not built**: an authoring UI (params are hand-authored JSON only, the same way `cases` started — TASKS.md's own history); `fix`/`predict` param support; a large/continuous parameter space beyond the `enumerateParamCombinations` 500-combination cap. |

## Task Types

| Item | Status | Notes |
|---|---|---|
| Shared task-component interface | ✅ | `Task = CodeTask \| ParsonsTask \| QuizTask \| PredictTask \| FixTask \| FillTask` (`lib/task/types.ts`); `components/task/TaskWorkspace.tsx` dispatches by `task.type` to `components/task-types/*View.tsx`. `lib/db/tasks.ts` and the session/practice routes hand back the union — every type TASK_SCHEMA.md documents has one now, and a future one is still a new branch plus a new file, not a rewrite |
| `code` | ✅ | Turtle surface and console surface both end to end. Console: plain Run is interactive (Python Runner, above), and Check runs `cases` — `lib/task/types.ts`'s `CodeTask`/`FixTask` carry `cases?: RunCase[]`, `lib/db/task-mapping.ts` copies `row.cases` through, and `useTaskRunner`'s warm-up seeds `target` from the first case's stdin instead of none. `runChecks` runs the student's code once per case (headless, that case's own stdin), evaluates `[...task.checks, ...case.checks]` against each, and merges every case's results into one report — a case beyond the first is a case that must also pass, exactly what stops a solution hardcoded to the visible case; a task with no `cases` is one implicit no-stdin case, so the old single-run behaviour is unchanged. `cases` now has an authoring surface too (Teacher Flow, "Task authoring UI") — a task with cases no longer requires hand-editing `content/seed-tasks/*.json`. `content/seed-tasks/grade7-code-rectangle-perimeter.json` exercises the whole path (a hidden second case with different expected numbers), proved by `tests/e2e/cases.spec.ts`, `tests/e2e/task-authoring-ui.spec.ts` and `tests/references/verify.spec.ts` |
| `quiz` | ✅ | Single/multiple choice, end to end: authoring (`NewTaskForm`, `QuizDraftEditor`), instant client-side checking (`choice_equals`, already in `lib/checker`), and a publish gate with no run and no canonical submission either — the correct answer lives entirely in `checks`, so `lib/task/quiz.ts` instead confirms every `choice_equals` index actually names an option (and exactly one, on a single-answer quiz) |
| `predict` | 🔶 | `answerMode: 'text'` and `'choice'` both end to end now: authoring (`NewTaskForm`, `PredictDraftEditor` — an answer-format selector plus an options textarea, reusing the same one-per-line convention as quiz), instant client-side checking (`text_equals` for text, `choice_equals` for choice, both already in `lib/checker`), and a publish gate that runs `payload.code` (there is no separate reference to write — it IS the code shown to the student). Text mode confirms the checks actually match its real stdout (`evaluatePredictionAgainstOwnRun`); choice mode additionally confirms `choice_equals` is structurally sound — exactly one index, in range (`lib/task/predict.ts`'s `validatePredictChoiceChecks`) — and that the chosen option's own text actually equals the real stdout (`evaluatePredictionChoiceAgainstOwnRun`), same rule 5 guarantee applied to a chosen option instead of a typed string. `PredictTaskView` renders radio options instead of a text input in choice mode. `tests/e2e/predict-choice.spec.ts` drives the whole path through the real forms and a real session join; `tests/e2e/task-authoring.spec.ts` covers the publish gate's success/failure/malformed-check paths directly. `imageOptions` is still not built — its data shape (where the N reference programs themselves would live) is undecided |
| `parsons` | ✅ | Both `indentMode: 'given'` and `'chosen'` end to end: authoring (`NewTaskForm`, `ParsonsDraftEditor` — an indent-mode selector alongside the lines/distractors fields), drag-and-keyboard assembly (`ParsonsTaskView`, dnd-kit), instant client-side checking (`order_equals`, already in `lib/checker`), and a publish gate with no run to post — `payload.lines` is already the correct order, checked server-side (`lib/task/parsons.ts`). `order_equals` gained an `indents` field alongside `checkIndent` (`lib/checker/evaluate.ts`): every line starts flat in chosen mode and the student sets each one's indent with Indent/Outdent buttons, graded against `payload.lines[i].indent` the same value `parsonsCanonicalSubmission` already used as the canonical answer. `tests/e2e/parsons-chosen.spec.ts` drives the whole path through the real forms and a real session join; `tests/e2e/task-authoring.spec.ts` and `lib/checker/evaluate.test.ts` cover the publish gate and the evaluator directly |
| `fill` | ✅ | End to end, also reusing `code`'s machinery: `FillTaskView` renders `payload.template` (`lib/task/fill.ts`'s `parseFillTemplate`) with an inline `<input>` at every `{{n}}` gap, substitutes the student's answers into a `code` string on Run/Check, and hands it to the same `useTaskRunner`/`RunnableTask` shape `fix` uses. Authoring (`NewTaskForm`, `FillDraftEditor`) writes a separately authored reference, exactly like `code`'s starter vs reference — the publish gate needed no special-casing at all, it falls into the same generic branch |
| `fix` | ✅ | End to end, reusing `code`'s machinery: `FixTaskView` and `useTaskRunner` are shared verbatim via a `RunnableTask` shape (`lib/task/use-task-runner.ts`) — the student edits `payload.broken` instead of `payload.starter`, same run/check/result flow. Authoring (`NewTaskForm`, `FixDraftEditor`) posts two runs to publish: `reference.code` must pass every check, and `payload.broken` (read from the saved row, not re-trusted from the request) must fail at least one — `lib/checker/reference-check.ts` already proved this exact rule for `checkTaskReference`/CI, and the publish route now enforces the same thing browser-side with `evaluateRun` |

## Lessons

The unit of content (AI_CONTEXT.md, "Course Structure"). Decided: explanations are Markdown with
**static** code examples, not runnable ones — the explanation screen never loads the Python
engine.

| Item | Status | Notes |
|---|---|---|
| `lessons` table | ✅ | `drizzle/0003_add_lessons.sql`: `slug`, `grade`, `order`, `kind` (`'mandatory' \| 'practice'`), `title`, `curriculum_ref`, `explanation_md`, ordered `core_task_ids`/`additional_task_ids` (uuid arrays, like `sessions.task_ids`). `order` is the ministry lesson number, so a missing lesson (39) slots in later without renumbering. `(grade, order)` is indexed but **not** unique — the seed upserts by slug and a reorder would collide mid-import; `lib/lessons/content.ts` rejects duplicates instead |
| Lesson content + seed | ✅ | `content/lessons/grade<N>.json` lists lessons with task **slugs**; the explanation is `content/lessons/grade<N>/<slug>.md`. `npm run db:seed` validates every lesson (`validateLessonContent`: known tasks, no task twice in a lesson, a core task at least, valid kind, unique order per grade) against every task in the database, then resolves slugs to uuids. Not part of `GET /api/tasks/export`/`import` yet — lessons live in git only |
| Explanation rendering | ✅ | `lib/lessons/markdown.ts` parses the subset lessons use (headings, paragraphs, lists, fenced code, inline code/bold/italic) into a tree; `components/lesson/Explanation.tsx` renders it as elements, never an HTML string, so nothing in content can inject markup. Unit-tested |
| Student: lesson list, lesson page, task in a lesson | ✅ | `/practice` lists a grade's lessons in order (`?grade=` switch when more than one grade has lessons); practice lessons are dashed and labelled «Можна пропустити, але краще не варто». `/practice/[lesson]` shows the explanation, then core tasks, then additional ones. `/practice/[lesson]/[task]` is the workspace plus a back link and a «Наступне завдання» link walking core into additional (`lib/lessons/view.ts`). Done marks and «N з M» counts come from local practice progress. A parameterized task is listed but marked «лише на занятті з учителем» and 404s in practice — it needs a student identity. Drafts are skipped. `tests/e2e/lessons.spec.ts` |
| Teacher: add a lesson in the session builder, graded-mode warning | ✅ | `SessionBuilderForm` gains «Додати урок цілком»: appends the lesson's published core then additional tasks, skipping ones already chosen (`addLessonToSelection`). In graded mode a non-blocking warning names every chosen task that is not a core task of some mandatory lesson, as «з практичного уроку» or «додаткове» (`lib/lessons/graded-warnings.ts`'s `findNonGradedTasks` — a task core in any mandatory lesson is fine; a task in no lesson is not warned about). Unit-tested, and covered in `tests/e2e/lessons.spec.ts` |
| Teacher-side lesson authoring | ❌ | Lessons are edited in `content/lessons/` and imported. No UI, no API |

## File Delivery

v1 done. `delivery: 'file'` on `code` and `fix` (TASK_SCHEMA.md); no new task type, no
change to `lib/checker/`. SPIKE.md's file-delivery checks (1's f-string rows, the
BOM/CRLF/line-number check, and check 7) have all been run. The download → IDLE → upload → Check
path works end to end for a single file in a session or in practice, all nine upload steps
included. `content/seed-tasks/grade8-code-idle-hello.json` (grade 8 lesson 43) exercises it,
proved by `tests/e2e/file-delivery.spec.ts`. Identical files across students are flagged to the
teacher, the teacher can download every student's latest file as one ZIP, and delivery is set in
the authoring UI. v1 is complete apart from the header picker, which only matters for a future
session-level upload.

| Item | Status | Notes |
|---|---|---|
| `delivery`/`file` on `CodePayload`/`FixPayload` | ✅ | `lib/task/types.ts`; `lib/task/payload-guards.ts` requires a well-formed `file` (`.py` name, positive integer `maxBytes`) when `delivery` is `'file'`. Payload is jsonb, so no migration. No authoring-UI control yet — set it in the task JSON |
| Starter-file generation (header + prompt + starter/broken) | ✅ | `lib/task/file.ts`'s `generateStarterFile`, downloaded client-side as a Blob by `components/task/FileDelivery.tsx`. No seed line — the browser never has the seed (TASK_SCHEMA.md, "Starter file generation") |
| Upload validation, steps 1–8 | ✅ | `lib/task/file.ts`'s `validateUpload`, pure and unit-tested (`file.test.ts`). Runs in the browser, since grading is client-side today anyway ("Cheating and Trust"); being pure, it moves to a route unchanged when v2 needs it. The accepted source is shown read-only and goes through the same `useTaskRunner` Run/Check as inline code; `submittedAnswer.code` stores it normalized |
| Header parsing (`taskId`/`version`/`seed`) with manual-selection fallback | 🔶 | `parseHeader` distinguishes ok / missing / altered. The picker is not built: uploading from inside a task already names it, so there the fallback is a note, and a header naming another task is a warning. The picker matters only for a future session-level upload with no task open |
| `PythonRunner.parse` + engine-neutral AST | ✅ | The parse question is answered by keeping it inside the runner: `parse()` on the interface, answered by the Worker (safe mid-run), and `lib/runner/ast.ts` converts Skulpt's 3.7-shaped tree to a CPython-`ast`-shaped `PyAstNode` so nothing outside `lib/runner/` sees Skulpt and a v2 CPython dump can feed the same linter. `lib/runner/node.ts` is the Node entry for scripts and unit tests. `ast.test.ts` plus three runner integration tests |
| AST-based compatibility linter + safe-subset allow-list | ✅ | `lib/task/file-lint.ts`, 23 unit tests on real Skulpt parses. The allow-list is proven, not asserted: `npm run confirm:safe-subset` runs the `scripts/safe-subset/` corpus on Skulpt and CPython and fails on any allow-list entry without matching, actually-exercised evidence — in CI too. Flags only names CPython knows (`cpython-names.json`), so a typo stays the student's error. Found four real divergences on the way (SPIKE.md check 1). Seed file tasks are linted in `verify.spec.ts` |
| `FILE_UNSUPPORTED` error class | ✅ | `LintFinding`s rendered by `FileDelivery.tsx` from `file.unsupported`/`file.replacement` in `messages/uk.json`: names the construct and line, offers a replacement, says it is Hilka's limitation, asks the student to tell the teacher. Not an attempt. Fails closed if the parse cannot complete |
| Runner fix: Unicode-aware `isalpha`/`isalnum`/`isupper`/`islower`/`istitle`/`title`/`swapcase` | ✅ | `lib/runner/modules/str-unicode.ts`, ports of CPython's algorithms, installed in the Worker and the Node loader. Matches CPython on every Latin/Greek/Cyrillic character (corpus sweep, in CI), unit-tested in `str-unicode.test.ts`, integration-tested in `tests/runner/runner.spec.ts`. Now on the safe subset; the linter no longer rejects them. Fixes inline string tasks on Ukrainian text as well |
| Delivery control in the authoring UI | ✅ | `components/authoring/FileDeliveryFields.tsx` on `NewTaskForm` (code/fix), `DraftTaskEditor` and `FixDraftEditor`: an on/off toggle, file name (defaults from the slug), size cap in KB, header on/off. `lib/task/delivery-form.ts` maps form ⇄ payload and validates (pure, unit-tested). Fixes a real bug on the way: both draft editors rebuilt the payload on save without `delivery`/`file`, so editing a JSON-imported file task silently turned it inline. Publish is gated on the safe subset: with file delivery on, Run reference also lints the reference and the starter/broken code (`file-lint-gate.ts`, the same rule `verify.spec.ts` enforces for seed tasks) and Publish stays off until it is clean, failing closed if the parse cannot complete. Browser-side, like every other publish gate. The published view states the delivery. `tests/e2e/file-delivery-authoring.spec.ts` |
| Duplicate-hash flagging across students in a session | ✅ | `POST /api/attempts` computes a SHA-256 of `submittedAnswer.code` server-side when the task (read from the database, not the body) has `delivery: 'file'`, stored as `attempts.flags.sourceHash` — jsonb, no migration. `lib/dashboard/shared-files.ts`'s `findSharedFiles` (pure, unit-tested) groups *passing* attempts by task + hash across two or more distinct students; failing ones are ignored so an untouched starter uploaded too early is not noise. The session dashboard shows an «Однакові файли» section only when a group exists, worded as a fact for the teacher to judge, never an accusation. `tests/e2e/file-delivery.spec.ts` drives two students uploading the same file through to the dashboard |
| Per-session bulk download of submitted files, for the teacher | ✅ | `GET /api/dashboard/sessions/[id]/files`, owner-scoped like the CSV export, returns a ZIP of each student's *latest* upload per file-delivery task, laid out `<task title>/<student>.py` (`lib/dashboard/submitted-files.ts`, names sanitized, collisions suffixed). `lib/dashboard/zip.ts` is a dependency-free stored-only ZIP writer with UTF-8 names so Cyrillic survives; unit-tested by reading the archive back, and checked against Python's `zipfile`. The session page links it only when a file-delivery attempt exists. Covered by the shared-files test in `tests/e2e/file-delivery.spec.ts` |

## Server-side CPython (v2)

**Planned, out of v1 scope.** The completion of File Delivery, not an alternative to it — see
AI_CONTEXT.md's "File Delivery" for why the linter (v1) is a stopgap rather than the final
design. A sandboxed serverless function runs an uploaded file on real CPython and returns stdout
and program state, which the same `Check[]` evaluates. This removes engine divergence entirely
for file tasks and closes the devtools-tampering hole in "Cheating and Trust" for exactly the
tasks that go through it. 2–4 s latency is accepted — the student has already spent minutes in
IDLE before uploading.

| Item | Status | Notes |
|---|---|---|
| Sandboxed serverless CPython execution for file-delivery tasks | ❌ | Planned; do not build before v1 (the safe subset + linter) ships and the sequencing rule is in place |

## Error Humanization

| Item | Status | Notes |
|---|---|---|
| `PyError` → Ukrainian message mapping | ✅ | `lib/errors/`. 20 rules, ordered, first match wins; calm fallback, never a traceback |
| Rule #1: arithmetic on `input()` result | ✅ | First in the rule base, and only fires when the code actually calls `input()` |
| Starter rule set | ✅ | NameError, SyntaxError (four source-read variants), TypeError, IndexError, ZeroDivisionError, ValueError, AttributeError, ImportError, KeyError, EOFError. Skulpt has no IndentationError — it is a SyntaxError read from the source |
| Timeout message phrased as "did not finish", not as an error | ✅ | `humanizeTimeout()`; a test asserts the word «помилка» never appears |
| Unmatched-error logging | ✅ | `unmatched_errors` table (`drizzle/0002_add_unmatched_errors.sql`), `lib/db/unmatched-errors.ts`, `POST /api/errors/unmatched`. No auth, no student/session/task reference — write-only telemetry to grow the rule base from, not an attempt (CLAUDE.md rule 8). `components/task/ResultPanel.tsx` installs `lib/errors/unmatched.ts`'s reporter seam once it is ever on screen (every task type that can run Python renders one), posting each unmatched `PyError` as it happens. `tests/e2e/practice.spec.ts` proves it with a real `RecursionError` — not in the starter rule set — round-tripping to a 201 and a row |

## Student Flow

| Item | Status | Notes |
|---|---|---|
| Practice mode (localStorage progress) | ✅ | `lib/practice/local-progress.ts`'s `useLocalProgress` — completed task slugs, primary store, no server round-trip to resume on the same machine. Practice is now organized by lesson ("Lessons", above): `/practice` is the lesson list, a task lives at `/practice/[lesson]/[task]`, and progress is shown per task and per lesson |
| Progress codes: mint, restore, merge | ✅ | `lib/practice/code.ts` (format/validate), `lib/db/progress-codes.ts` (mint/update/read), `POST /api/progress` + `POST /api/progress/restore`, rate-limited by `lib/practice/rate-limit.ts`. `components/practice/ProgressPanel.tsx` is the UI, merge-not-replace via `mergeProgress`. `state` holds only `completedTaskSlugs` today — `xp`/"current topic" are Meta Layer, not invented ahead of it; the jsonb column needs no migration to add them later |
| Task runner shell (three-zone layout) | 🔶 | `components/task/TaskWorkspace.tsx`. Now reused by both `/practice` (constant task, wrapped by `components/practice/PracticePageClient.tsx` for local progress) and a session (task chosen from its list); an optional `onSubmitAttempt` prop reports each Check's outcome without practice mode knowing sessions exist |
| Join by 6-char code | ✅ | `app/(student)/s/[code]/page.tsx` + `lib/db/sessions.ts` `getOpenSessionByCode`. Case-insensitive; a closed or unknown code lands on the same calm not-found screen, on purpose — the distinction is for the teacher |
| Name selection from roster | ✅ | `components/session/SessionRoom.tsx`. Kept in `sessionStorage` per session code via `useSyncExternalStore`, so a reload does not ask again |
| Attempt submission (append-only) | ✅ | `POST /api/attempts` → `lib/db/attempts.ts`. Validated server-side against the open session, its assigned tasks and the roster (`validateAttemptContext`) — the request body itself is untrusted, per "Cheating and Trust" |
| Loading state for Skulpt | ✅ | Engine state surfaced through `warmUp()`; buttons disabled with a line saying why |
| Exam mode: timer, no hints, single submit | ✅ | Not a separate flag — enforces the session builder's existing three knobs. `components/session/SessionRoom.tsx`: `hintsEnabled` threads through `TaskWorkspace` into every task-type view's `Hints` call (empty array when off); `timeLimitS` drives a countdown anchored in `sessionStorage` at name-pick time (survives a reload, never grants extra time), and time-up replaces the whole session with a calm terminal screen; `mode === 'graded'` locks a task to its first Check result (pass or fail) — `'practice'` keeps unlimited retries, unchanged. Resolves the open question below on graded finality. Enforcement is UI-only, same as the rest of this flow (CLAUDE.md rule 4) — the dashboard still reads every attempt actually posted |

## Teacher Flow

| Item | Status | Notes |
|---|---|---|
| Magic-link auth | 🔶 | `lib/auth/`. Hashed single-use tokens (`teacher_login_tokens`), a signed cookie, no session table. Email via Resend (`lib/auth/login-email.ts`, unit-tested with an injected `fetch`), sent in `after()` so response timing leaks nothing; `devLoginUrl` and the logged link survive only outside Vercel, for CI. **Not verified live**: needs `RESEND_API_KEY` and `EMAIL_FROM` (verified domain) in Vercel — CI_CD.md §5. Teachers are provisioned directly in the database; there is no self-signup |
| Task authoring UI | 🔶 | `NewTaskForm` plus a per-kind draft editor (`ParsonsDraftEditor`, `QuizDraftEditor`, `PredictDraftEditor`, `FixDraftEditor`, `FillDraftEditor`) cover all six types, and `tests/e2e/task-authoring-ui.spec.ts` drives each one through the real forms to a publish. `cases` now has an authoring surface too, same shape as `checks` — a raw JSON textarea (`parseCasesJson`, `components/authoring/task-form-utils.ts`) on `NewTaskForm` (code/fix only) and on `DraftTaskEditor`/`FixDraftEditor`, which run the reference once per case and show each case's own output, labeled with the case's own `label` when it has one. Publish (`POST /api/tasks/[id]/publish`) validates every case's run against `[...task.checks, ...case.checks]` before writing anything — the browser-computed equivalent of `checkTaskReference`. `tests/e2e/task-authoring-ui.spec.ts` proves a hidden case with a different expected number blocks Publish until the reference actually solves it, not just the visible one. What is still not built is the per-kind *visual* builder for `checks`/`cases` — both stay raw JSON, 15 check kinds being a separate, larger slice — and `hints`/`gradeTags` remain plain-text fields (one per line / comma-separated) rather than dynamic add-remove lists. `/tasks` lists every task (draft + published); `/tasks/new` creates a draft; `/tasks/[id]` edits a draft and runs+publishes its reference, or shows a read-only view once published (cases included, when the task has any) |
| Draft / publish + version bump | ✅ | `POST /api/tasks` (draft, `code` only), `PATCH /api/tasks/[id]` (edit while draft), `POST /api/tasks/[id]/publish` (the gate) — all wired to the forms above. No server-side Python (AI_CONTEXT.md), so the reference solution runs in the teacher's browser and the computed run is posted to publish, which re-evaluates it server-side with `evaluateAgainstOwnRun` before writing `reference` + flipping `status` + bumping `version` (0 while draft, 1 on first publish). One-way per version: a published task cannot be re-edited here — re-drafting is separate, unbuilt work. `tests/e2e/task-authoring.spec.ts` covers the API directly; `tests/e2e/task-authoring-ui.spec.ts` covers it through the forms |
| Class + roster management | ✅ | `/classes/new` creates a class (title + roster, one name per line, reusing `parseHints`'s convention); `/classes/[id]` edits both, scoped to the owning teacher (`lib/db/classes.ts`'s `createClass`/`updateClass`, `POST`/`PATCH /api/classes`). `/sessions/new`'s empty state now links there instead of describing a gap. `scripts/db/seed-demo-session.ts` remains for seeding the e2e fixture, not the only path anymore |
| Session builder | ✅ | `/sessions/new` (`components/authoring/SessionBuilderForm.tsx`) — picks one of the teacher's classes, filters the published task catalog by topic and grade client-side (small enough not to need a filtered query), assigns tasks in click order (`sessions.task_ids`'s order), sets time limit/hints/shuffle. `POST /api/sessions` (`lib/db/session-authoring.ts`) mints a 6-char code unique among open sessions (same bounded-retry shape as `mintProgressCode`) and silently drops any submitted task id that is not actually published. `timeLimitS`/`hintsEnabled`/`mode` are now enforced client-side in `SessionRoom` ("Exam mode", above); `shuffle` is still stored but unread |
| Results dashboard | ✅ | `app/(teacher)/dashboard/` — classes, their sessions, and a session's attempts (student, task, pass/fail, hints, duration), each scoped to the logged-in teacher, plus a CSV export. The session detail page now polls: `components/dashboard/AutoRefresh.tsx` calls `router.refresh()` every 5 s while `session.open` (`closesAt === null`, `lib/db/sessions.ts`), re-running the server component in place — no separate client data layer, verified end to end (a second browser context submits an attempt, the first picks it up with no reload). Above the attempt log, a "Хто потребує допомоги" student × task rollup (`lib/dashboard/rollup.ts`'s pure, unit-tested `buildRollup`) marks each cell not-started / passed / stuck — stuck meaning tried and never passed, never merely "hasn't gotten there yet" — sorted so the most-stuck student is first; shape and icon carry the meaning, not colour alone |
| Suggested grade for graded sessions | 🔶 | `lib/grading/` (pure, unit-tested): `suggestGrade` per student from the session's tasks and attempts, config in `lib/grading/config.ts` (AI_CONTEXT.md, "Grading"). Partial credit is recorded per attempt in the existing `attempts.score` column (share of input cases passed, from `use-task-runner.ts`). A graded session's rollup table gets an «Орієнтовна оцінка» column (points on hover, the cap at 9 marked), a note when no task can open the high band, and `GET /api/dashboard/sessions/[id]/grades` exports one row per student as CSV. `tests/e2e/grading.spec.ts`. **Not built**: a teacher's per-student override stored in Hilka, and per-session editing of the config — both need a schema change |
| CSV export | ✅ | `GET /api/dashboard/sessions/[id]/export`, scoped to the owning teacher via the same `getSessionForTeacher` check the session detail page itself uses. `lib/dashboard/csv.ts`'s `attemptsToCsv` is pure and unit-tested (UTF-8 BOM for Excel's sake, proper quoting); the "Завантажити CSV" link only appears once there is at least one attempt to export |
| JSON export/import of all tasks | ✅ | `lib/db/content-io.ts`'s `exportContent`/`importContent`, same shape as `content/topics.json` + `content/seed-tasks/*.json`. `GET /api/tasks/export` downloads every topic and task (draft included); `POST /api/tasks/import` upserts by slug, validated in full (unknown topics, `validateTaskChecks`) before anything is written, so a bad bundle never half-imports. `/tasks` (`ImportExportControls`) wraps both — a link and a file input, `router.refresh()` on success. `tests/e2e/task-import-export.spec.ts` covers auth, round-trip export→import→export, upsert-not-duplicate, and both rejection paths |

## Meta Layer

| Item | Status | Notes |
|---|---|---|
| XP + topic progress | ❌ | Sprint 2 |
| Garden / growth visual | ❌ | Sprint 2. Lives between tasks, never on the workspace. |
| Additional tasks for fast students | 🔶 | Mechanism and grade 7 content exist — each lesson's `additional_task_ids`, shown after the core tasks ("Lessons", above), populated for every grade 7 practice lesson and most mandatory ones. Nothing in the meta layer rewards them yet |

## Content

| Item | Status | Notes |
|---|---|---|
| Curriculum mapping (grades 7–9) | ✅ | See CURRICULUM.md — 28 topics, grade tags, ~62 addressable lessons |
| Topic rows for grade 7 | ✅ | `content/topics.json` — the 13 topics of the grade 7 section, seeded. Grades 8–9 follow with their content |
| Grade 7 sem-2 block: intro → loops-for + turtle-basics | ✅ | Superseded by the per-lesson content pass below: the whole grade 7 section (lessons 25–42) now has content, not just this block |
| First topic, ~12 tasks | ✅ | Twelve tasks across nine topics (turtle-loops has two): `grade7-code-print-python.json` (intro), `grade7-turtle-square.json` (turtle-basics), `grade7-quiz-variable-names.json` (variables), `grade7-predict-arithmetic.json` (arithmetic), `grade7-code-rectangle-perimeter.json` (linear — also the first task with `cases`, see "code" above), `grade7-code-sign-of-number.json` (conditions — `if`/`elif`/`else` with three input cases), `grade7-fix-alternating-steps.json` (turtle-conditions — a broken `if` inside a loop, geometry-checked), `grade7-code-sum-until-zero.json` (loops-while — a sentinel-controlled accumulator), `grade7-parsons-triangle.json` and `grade7-fill-pentagon.json` (turtle-loops), `grade7-predict-for-range-sum.json` (loops-for), `grade7-fix-square.json` (debugging), imported by `npm run db:seed`. Every reference solution (and, for `fix`, every broken payload) is verified against its own checks by `npm run verify:references`. |
| Second content pass, +16 tasks | ✅ | Brings the 9 sem-2-block topics from one task each to 2–3, `code`/`predict`/`quiz` only (no new `fix`/`fill`/`parsons` this pass): intro gets `grade7-quiz-print-purpose.json` and `grade7-code-two-lines.json`; variables gets `grade7-predict-reassign.json` and `grade7-code-city-sentence.json` (its first task using an f-string); arithmetic gets `grade7-code-product-two-numbers.json` (cases, negative-number branch) and `grade7-quiz-integer-division.json`; linear gets `grade7-code-rectangle-area.json` and `grade7-code-average-three.json`; turtle-basics gets `grade7-code-turtle-rectangle.json` (asymmetric sides, `translate`-only normalize); conditions gets `grade7-code-max-of-two.json` (three cases incl. a tie) and `grade7-quiz-range-condition.json`; turtle-conditions gets `grade7-code-turtle-alternating-hexagon.json` (6-segment shape, `i % 2` alternation, geometrically verified to close); loops-while gets `grade7-code-power-of-two-while.json` (cases incl. n already a power of two and n = 1, zero-iteration case) and `grade7-predict-count-halving.json`; loops-for gets `grade7-code-multiplication-table.json` (first seed task using `numbers_equal` to check every line, not just the last) and `grade7-quiz-range-count.json`. All 16 verified via `npm run verify:references` (30/30 passing); not yet imported into any live database — `npm run db:seed` needs `DATABASE_URL`, which this session doesn't have. |
| Third content pass, +2 tasks (turtle-conditions) | ✅ | `grade7-code-turtle-three-way-steps.json` — first turtle-conditions task using a three-way `if`/`elif`/`else` (not just `if`/`else`), a 6-segment shape with a length cycling through `i % 3`. `grade7-fix-turtle-three-way-order.json` — same target shape, broken by swapping the `elif` branch order; both the geometric closure (opposite-pair symmetry over the 6-step `i % 3` cycle) and that the broken version actually produces a different, `shape_equals`-failing hexagon were checked by hand before authoring. turtle-conditions now has 4 tasks, one more than every other topic in this block. Verified via `npm run verify:references` (32/32 passing, `checkTaskReference` confirms `payload.broken` fails as required); not yet imported into any live database. |
| Mandatory vs practice lessons | ✅ | A `lessons` table (see "Lessons", above), not a tag on topics/tasks. All of grade 7's lessons 25–42 are seeded from `content/lessons/grade7.json` + one explanation `.md` per lesson — 18 lessons, 12 mandatory, 6 practice; the project lessons 43–46 are out of scope (CURRICULUM.md). Every grade 7 seed task sits in exactly one lesson |
| Grade 7 content per lesson, +48 tasks | ✅ | Every lesson 25–42 now has 3–5 core tasks, and every practice lesson has additional ones (79 grade 7 tasks, up from 31). **Every mandatory lesson's core set ends with a difficulty 4–5 task**, so a graded session built from any one mandatory lesson can open the 10–12 band (AI_CONTEXT.md, "Grading"); additional tasks go up to difficulty 5 (leap year, prime check, triangle type, a flower of squares, concentric squares). New lessons 39 (nested conditions) and 41–42 (dynamic graphics: frames drawn with `clear()`/`goto`, checked on the final frame with an un-normalized `shape_equals` — the explanation says so and points to IDLE for the real motion). Mixed types: `code` (console with hidden cases, turtle), `predict` (text and choice), `quiz`, `fix` (syntax and logic bugs, including one with two bugs). `forbids` is used only where the lesson is about the construct (`min`, `len`/`str`, `factorial`), never on names a student would plausibly pick for a variable, e.g. `sum`. All 82 references pass `npm run verify:references`. Writing these found the `goto` runner bug (Python Runner, above) |
| Grade tagging of tasks | ✅ | Stale as of the last edit: every seed task already carries `gradeTags: [7]` (`content/seed-tasks/*.json`), the authoring forms read/write it (`task-form-utils.ts`'s `parseGradeTags`), and the session builder filters by it. What is still open is populating grades 8–9, which is content work (see "Grade 7 sem-2 block…" and the curriculum mapping), not this mechanism |

## Open Questions

- [x] Hosting — Vercel Hobby + Neon. Hetzner only if server-side execution is added.
- [x] Offline support — dropped. Online-only, accessible from anywhere.
- [x] Skulpt vs Pyodide — Skulpt for v1, behind an adapter. Revisit if the spike fails.
- [x] Task storage — database as source of truth, with JSON export to git.
- [x] Visual style — cozy; tool-like workspace, game-like reward layer.
- [ ] Neon cold start on the first request of a lesson. Unmeasured, and it lands on the
      student who opens `/practice` first — measure it on the classroom machine, not a laptop.
- [x] What a student should see when the database is unreachable mid-lesson. **A calm Ukrainian
      error boundary with a retry button** — `app/error.tsx`, deliberately generic (no way to
      tell a connection failure from any other unexpected error at this boundary). Distinct from
      a task being unpublished or a session being closed, which stay their own specific
      `not-found.tsx` screens reached through `notFound()`. `app/(dev)/error-boundary/` throws on
      purpose so `tests/e2e/error-boundary.spec.ts` can exercise it deterministically, without
      taking down the shared database other specs run against. The root layout touches no
      database, so `global-error.tsx` is not needed yet.
- [x] Grade→score mapping to the 12-point scale. **Decided with the teacher** — AI_CONTEXT.md,
      "Grading": points by difficulty, partial credit per input case, 75% after a hint, bands
      1–3 ≤ 15%, 4–6 ≤ 60%, 7–9 ≤ 75%, 10–12 above and only with a solved difficulty 4–5 task.
- [x] Is a graded attempt final on first submit, or best-of-N? **Final on first submit** —
      exam mode locks a task to its first Check result once `session.mode === 'graded'`
      (`components/session/SessionRoom.tsx`). `'practice'` sessions keep unlimited retries.
- [x] Does the advanced branch share a topic with the main track or sit in a separate one?
      **Shares it.** Fast students go deeper via each practice lesson's additional tasks
      (AI_CONTEXT.md, "Course Structure").
- [x] Curriculum — supplied and mapped in CURRICULUM.md. Programming runs in semester 2 in all
      three grades, so the deadline is roughly January, not September.
- [x] Practice progress — save-code system. localStorage primary, code for portability.
- [x] Grade 8 plan says 1.5 h/week but lists 70 lessons and is filenamed "2 ГОД". Which is it?
      **Neither matters.** Content is not scheduled to hours or dates — mandatory lessons plus
      skippable practice lessons (docs/CURRICULUM.md).
- [ ] Is the grid world worth building at all now that turtle is the curriculum's visual layer?
- [x] Does interactive input need SharedArrayBuffer? **No.** Verified with
      `crossOriginIsolated=false`; no COOP/COEP headers on Vercel, embeds stay possible.
- [x] Default `parsons.indentMode` per topic — **both modes are built now** (`order_equals` grades
      an expected indent via `checkIndent`/`indents`, docs/TASK_SCHEMA.md); the recommendation
      itself stands as authored: `'given'` for a topic's first Parsons task, `'chosen'` later,
      left to the author per task rather than enforced per topic.
- [x] Lesson 40 (grade 7) requires покрокове виконання. **Covered by the playback scrubber**
      (`components/canvas/PlaybackScrubber.tsx`), stepping the turtle drawing by call order
      rather than an interpreter-level stepper — no need to fall back to `predict`/`fix` tasks
      or to teach it outside the platform.
- [x] Which Python version is installed alongside IDLE on the classroom machines? **CPython
      3.10.** The safe subset is re-confirmed on 3.10.20, `lib/task/cpython-names.json` is
      regenerated from it, and CI's `verify` job pins 3.10 (docs/SPIKE.md, check 1).
- [ ] Multi-file projects with local imports — needed for the grade 9 projects, or is a single
      file enough for v1? See AI_CONTEXT.md's "File Delivery" v1 scope limit.
- [ ] Should a file-delivery task be blocked in the UI until its in-browser prerequisite is
      passed (the sequencing rule in AI_CONTEXT.md), or only ordered that way by convention,
      left to the teacher?

## Recommended Implementation Order

1. **Spike (SPIKE.md).** Static page, worst machine in the classroom. Everything below assumes
   it passes. Do not scaffold Next.js first — the results can change the stack.
2. Runner adapter + Worker + timeout + module stubs (`turtle`, `random`).
3. Checker evaluator with the non-Python check kinds.
4. ~~One `code` task, hard-coded, end to end~~ — done. `/practice` runs the grade 7 square:
   prompt → editor → run → check → result, with the target overlaid on the student's drawing.
5. ~~Error humanization, starter rule set~~ — done. Messages were written against Skulpt's
   recorded wording, not CPython's.
6. ~~Database + Drizzle schema, task loaded from the DB instead of hard-coded~~ — done.
   `/practice` reads a published task through `lib/db/`; drafts are invisible and republishing
   changes what the class sees without a deploy. Neon itself is still a manual step.
7. ~~Session create/join/submit + attempts~~ — done, scoped: no session builder or teacher
   auth exist yet, so a demo session is seeded directly in the database
   (`scripts/db/seed-demo-session.ts`). `/s/[code]` joins, picks a name from the roster, runs
   any assigned task, and each Check posts an append-only row to `/api/attempts`, checked
   server-side against the open session, its task list and the roster.
8. ~~Teacher dashboard, read-only first~~ — done, scoped: magic-link auth is real (hashed
   single-use tokens, signed cookie) but email delivery is not, so `POST /api/auth/request-link`
   hands the link back directly outside a real Vercel deployment instead of sending it
   (`docs/AI_CONTEXT.md`, "Teacher Auth"). `/dashboard` shows a teacher's own classes, sessions
   and attempts; no session builder or authoring UI yet, so there is nothing to create or edit
   from it.
9. ~~Task authoring UI~~ — done, scoped to `code` tasks: `/tasks`, `/tasks/new`, `/tasks/[id]`
   (edit a draft, run and publish its reference, or view it read-only once published). Checks
   are authored as raw JSON, not a per-kind visual builder; that and the other five task types
   are still open.
10. ~~Remaining task types, `parsons` first~~ — done. All six types (`parsons` with both
    `indentMode`s, `quiz`, `predict` with `answerMode: 'text'` and `'choice'`, `code`, `fix`,
    `fill`) work end to end (docs/TASK_SCHEMA.md). One partial build remains, documented rather
    than silently missing: predict's `imageOptions` (its data shape — where the N reference
    programs would live — is undecided). The shared task-component interface this needed (`Task`
    union, `TaskWorkspace` dispatching by type) is what made `fix` and `fill` a new branch and a
    new file each, not a rewrite.
11. ~~Turtle canvas, target overlay, playback scrubber~~ — done. The canvas and target overlay
    shipped earlier; the playback scrubber (`components/canvas/PlaybackScrubber.tsx`) now steps
    a turtle drawing segment by segment, driven by call order since `Segment.line` is always
    null (docs/AI_CONTEXT.md's Gotchas). Wired into `code`, `fix`, `fill`. Grid only if still
    justified afterwards.
12. Meta layer.

Building the authoring UI early is the standing temptation, because it feels like foundation.
It is not — it is CRUD, it takes days, and it teaches nothing about whether the core works.
