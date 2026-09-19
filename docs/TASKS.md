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

See CI_CD.md. Phases A and B are live — CI on every PR, and deploys to Vercel against
Neon. What is left of B is the `production` environment that gates `migrate.yml`.

| Item | Status | Notes |
|---|---|---|
| Docs in the repository | ✅ | A cloud session clones the repo; without these it starts blind |
| Cloud environment for remote sessions | 🔶 | Sessions run, but the network policy blocks `*.vercel.app` and `*.neon.tech`: an agent can neither open a deploy nor reach the database, and has to ask a human what the live site shows |
| `SessionStart` hook + permission allowlist | ✅ | `.claude/settings.json`; no-op until `package.json` exists |
| Guardrail script + workflow | ✅ | CLAUDE.md rules 1, 3, 4 and the convention rules, as checks |
| GitHub Pages deploy of `spike/` | 🔶 | Workflow committed; Pages source must be switched on in repo settings |
| Spike harness itself | ✅ | `spike/` — six checks, Skulpt vendored, turtle stub, interactive input |
| Branch protection on `main` | 🔶 | Ruleset committed at `.github/rulesets/main.json`; must be imported in repo settings |
| `ci.yml` — typecheck, lint, tests | ✅ | Live, with the migration-drift step. The browser job runs a Postgres service, migrates and seeds — the workspace reads its task from the database |
| `migrate.yml` — Drizzle on merge | 🔶 | Staged; needs the `production` GitHub environment |
| `reference-check.yml` — references vs their own checks | ✅ | Live. `npm run verify:references` drives the real runner via `/runner` (no database needed) against `content/seed-tasks/*.json` |
| Vercel Git integration + preview deploys | ✅ | Installed; PR #7 carried its check. **Deployment Protection is on**, so a logged-out classroom machine cannot open a preview until Vercel Authentication is off or a sharable link is used — CI_CD.md §5 |
| Neon branch-per-preview | 🔶 | Integration installed. Unverified: that *"create a branch for each preview deployment"* is on and a PR preview really gets its own branch |

## Python Runner

| Item | Status | Notes |
|---|---|---|
| `PythonRunner` interface | ✅ | `lib/runner/types.ts`. Guardrail check enforces the boundary |
| Skulpt worker adapter | ✅ | `lib/runner/skulpt-runner.ts` + `worker.ts`. Timeout, cancel, stdout streaming |
| Interactive input line in the output panel | 🔶 | Runner side works end to end; the panel UI arrives with the workspace |
| Headless run with queued `stdin` per case | ✅ | `mode: 'headless'` with `stdin[]`; integration test covers it |
| Timeout paused across input suspensions | ✅ | `Sk.execStart` pushed forward by the wait; test covers a 2.5 s answer against a shorter limit |
| `turtle` module stub (records, draws nothing) | ✅ | `lib/runner/modules/turtle.ts` |
| Segment log + source-line attribution | ✅ | Segment log works; `line` is always null by design, playback uses call order |
| Canvas renderer (student + translucent target, one renderer) | ✅ | `components/canvas/TurtleCanvas.tsx`. One transform for both drawings |
| Playback scrubber with line highlighting | ❌ | Covers grade 7 lesson 40 without an interpreter stepper |
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
| Parameterized variants + seeded PRNG | ❌ | `hash(session_id + student_name + task_id)` |

## Task Types

| Item | Status | Notes |
|---|---|---|
| Shared task-component interface | ✅ | `Task = CodeTask \| ParsonsTask \| QuizTask \| PredictTask \| FixTask \| FillTask` (`lib/task/types.ts`); `components/task/TaskWorkspace.tsx` dispatches by `task.type` to `components/task-types/*View.tsx`. `lib/db/tasks.ts` and the session/practice routes hand back the union — every type TASK_SCHEMA.md documents has one now, and a future one is still a new branch plus a new file, not a rewrite |
| `code` | 🔶 | Turtle surface end to end. Console surface still open |
| `quiz` | ✅ | Single/multiple choice, end to end: authoring (`NewTaskForm`, `QuizDraftEditor`), instant client-side checking (`choice_equals`, already in `lib/checker`), and a publish gate with no run and no canonical submission either — the correct answer lives entirely in `checks`, so `lib/task/quiz.ts` instead confirms every `choice_equals` index actually names an option (and exactly one, on a single-answer quiz) |
| `predict` | 🔶 | `answerMode: 'text'` end to end: authoring (`NewTaskForm`, `PredictDraftEditor`), instant client-side checking (`text_equals`, already in `lib/checker`) against a value verified at publish, and a publish gate that runs `payload.code` (there is no separate reference to write — it IS the code shown to the student) and confirms the checks actually match its real stdout (`evaluatePredictionAgainstOwnRun`), same as `code`'s rule 5 guarantee. `answerMode: 'choice'` and `imageOptions` are not built: nothing authors or renders them yet |
| `parsons` | 🔶 | `indentMode: 'given'` end to end: authoring (`NewTaskForm`, `ParsonsDraftEditor`), drag-and-keyboard assembly (`ParsonsTaskView`, dnd-kit), instant client-side checking (`order_equals`, already in `lib/checker`), and a publish gate with no run to post — `payload.lines` is already the correct order, checked server-side (`lib/task/parsons.ts`). `indentMode: 'chosen'` is not built: `order_equals` has nowhere to read an expected indent from, so the authoring API rejects it and the component only ever renders `'given'` |
| `fill` | ✅ | End to end, also reusing `code`'s machinery: `FillTaskView` renders `payload.template` (`lib/task/fill.ts`'s `parseFillTemplate`) with an inline `<input>` at every `{{n}}` gap, substitutes the student's answers into a `code` string on Run/Check, and hands it to the same `useTaskRunner`/`RunnableTask` shape `fix` uses. Authoring (`NewTaskForm`, `FillDraftEditor`) writes a separately authored reference, exactly like `code`'s starter vs reference — the publish gate needed no special-casing at all, it falls into the same generic branch |
| `fix` | ✅ | End to end, reusing `code`'s machinery: `FixTaskView` and `useTaskRunner` are shared verbatim via a `RunnableTask` shape (`lib/task/use-task-runner.ts`) — the student edits `payload.broken` instead of `payload.starter`, same run/check/result flow. Authoring (`NewTaskForm`, `FixDraftEditor`) posts two runs to publish: `reference.code` must pass every check, and `payload.broken` (read from the saved row, not re-trusted from the request) must fail at least one — `lib/checker/reference-check.ts` already proved this exact rule for `checkTaskReference`/CI, and the publish route now enforces the same thing browser-side with `evaluateRun` |

## Error Humanization

| Item | Status | Notes |
|---|---|---|
| `PyError` → Ukrainian message mapping | ✅ | `lib/errors/`. 20 rules, ordered, first match wins; calm fallback, never a traceback |
| Rule #1: arithmetic on `input()` result | ✅ | First in the rule base, and only fires when the code actually calls `input()` |
| Starter rule set | ✅ | NameError, SyntaxError (four source-read variants), TypeError, IndexError, ZeroDivisionError, ValueError, AttributeError, ImportError, KeyError, EOFError. Skulpt has no IndentationError — it is a SyntaxError read from the source |
| Timeout message phrased as "did not finish", not as an error | ✅ | `humanizeTimeout()`; a test asserts the word «помилка» never appears |
| Unmatched-error logging | 🔶 | Collected in-session behind a reporter seam. The endpoint arrives with the database |

## Student Flow

| Item | Status | Notes |
|---|---|---|
| Practice mode (localStorage progress) | ❌ | Primary store; no server round-trip to resume on the same machine |
| Progress codes: mint, restore, merge | ❌ | 8 chars, unambiguous alphabet, rate-limited entry, merge-not-replace |
| Join by 6-char code | ❌ | Code must be legible from the back row on a projector |
| Name selection from roster | ❌ | No password, no email |
| Task runner shell (three-zone layout) | 🔶 | `components/task/TaskWorkspace.tsx`. Now reused by both `/practice` (constant task) and a session (task chosen from its list); an optional `onSubmitAttempt` prop reports each Check's outcome without practice mode knowing sessions exist |
| Join by 6-char code | ✅ | `app/(student)/s/[code]/page.tsx` + `lib/db/sessions.ts` `getOpenSessionByCode`. Case-insensitive; a closed or unknown code lands on the same calm not-found screen, on purpose — the distinction is for the teacher |
| Name selection from roster | ✅ | `components/session/SessionRoom.tsx`. Kept in `sessionStorage` per session code via `useSyncExternalStore`, so a reload does not ask again |
| Attempt submission (append-only) | ✅ | `POST /api/attempts` → `lib/db/attempts.ts`. Validated server-side against the open session, its assigned tasks and the roster (`validateAttemptContext`) — the request body itself is untrusted, per "Cheating and Trust" |
| Loading state for Skulpt | ✅ | Engine state surfaced through `warmUp()`; buttons disabled with a line saying why |
| Exam mode: timer, no hints, single submit | ❌ | |

## Teacher Flow

| Item | Status | Notes |
|---|---|---|
| Magic-link auth | 🔶 | `lib/auth/`. Real login mechanism — hashed single-use tokens (`teacher_login_tokens`), a signed cookie, no session table — but no email provider is wired up: `POST /api/auth/request-link` logs the link and returns it as `devLoginUrl` outside a real Vercel deployment. Teachers are provisioned directly in the database; there is no self-signup |
| Task authoring UI | 🔶 | `code` tasks only, scoped to what the rest of the app actually supports end to end — the other five types have no payload shape or checker support yet, so this is not five sixths done. `/tasks` lists every task (draft + published); `/tasks/new` creates a draft; `/tasks/[id]` edits a draft and runs+publishes its reference, or shows a read-only view once published. `checks` is authored as raw JSON (validated by `validateTaskChecks`, same as `npm run db:seed`), not a per-kind visual builder — 15 check kinds make that a separate, larger slice. `hints`/`gradeTags` are plain-text fields (one per line / comma-separated), not dynamic add-remove lists. `tests/e2e/task-authoring-ui.spec.ts` drives the real forms end to end, on top of the API-level coverage below |
| Draft / publish + version bump | ✅ | `POST /api/tasks` (draft, `code` only), `PATCH /api/tasks/[id]` (edit while draft), `POST /api/tasks/[id]/publish` (the gate) — all wired to the forms above. No server-side Python (AI_CONTEXT.md), so the reference solution runs in the teacher's browser and the computed run is posted to publish, which re-evaluates it server-side with `evaluateAgainstOwnRun` before writing `reference` + flipping `status` + bumping `version` (0 while draft, 1 on first publish). One-way per version: a published task cannot be re-edited here — re-drafting is separate, unbuilt work. `tests/e2e/task-authoring.spec.ts` covers the API directly; `tests/e2e/task-authoring-ui.spec.ts` covers it through the forms |
| Class + roster management | ❌ | Roster is a plain string array |
| Session builder | ❌ | Filter by topic and grade tag, set limit and hint availability. Until this exists, `scripts/db/seed-demo-session.ts` (`npm run db:seed:demo`) creates one demo teacher/class/open session directly, so the join flow has something to join |
| Results dashboard | 🔶 | `app/(teacher)/dashboard/` — read-only: classes, their sessions, and a session's attempts (student, task, pass/fail, hints, duration), each scoped to the logged-in teacher. No polling yet (a page load is enough for a read-only first cut), no class table "who is stuck" rollup, no CSV |
| CSV export | ❌ | |
| JSON export/import of all tasks | ❌ | Backup, git history, handoff to another teacher |

## Meta Layer

| Item | Status | Notes |
|---|---|---|
| XP + topic progress | ❌ | Sprint 2 |
| Garden / growth visual | ❌ | Sprint 2. Lives between tasks, never on the workspace. |
| Advanced branch for fast students | ❌ | Sprint 2 |

## Content

| Item | Status | Notes |
|---|---|---|
| Curriculum mapping (grades 7–9) | ✅ | See CURRICULUM.md — 28 topics, grade tags, ~62 addressable lessons |
| Topic rows for grade 7 | ✅ | `content/topics.json` — the 13 topics of the grade 7 section, seeded. Grades 8–9 follow with their content |
| Grade 7 sem-2 block: intro → loops-for + turtle-basics | ❌ | ~9 topics. First thing that reaches a classroom. |
| First topic, ~12 tasks | 🔶 | Six tasks across five topics (turtle-loops has two): `content/seed-tasks/grade7-turtle-square.json` (turtle-basics), `grade7-parsons-triangle.json` and `grade7-fill-pentagon.json` (turtle-loops), `grade7-quiz-variable-names.json` (variables), `grade7-predict-arithmetic.json` (arithmetic), `grade7-fix-square.json` (debugging), imported by `npm run db:seed` |
| Grade tagging of tasks | ❌ | |

## Open Questions

- [x] Hosting — Vercel Hobby + Neon. Hetzner only if server-side execution is added.
- [x] Offline support — dropped. Online-only, accessible from anywhere.
- [x] Skulpt vs Pyodide — Skulpt for v1, behind an adapter. Revisit if the spike fails.
- [x] Task storage — database as source of truth, with JSON export to git.
- [x] Visual style — cozy; tool-like workspace, game-like reward layer.
- [ ] Neon cold start on the first request of a lesson. Unmeasured, and it lands on the
      student who opens `/practice` first — measure it on the classroom machine, not a laptop.
- [ ] What a student should see when the database is unreachable mid-lesson. A task that is
      merely unpublished has a calm Ukrainian page; a connection failure currently falls through
      to Next's own error page, in English.
- [ ] Grade→score mapping to the 12-point scale — needs a teacher's decision, not a default.
- [ ] Is a graded attempt final on first submit, or best-of-N? Affects the attempts query and
      the exam UI.
- [ ] Does the advanced branch share a topic with the main track or sit in a separate one?
- [x] Curriculum — supplied and mapped in CURRICULUM.md. Programming runs in semester 2 in all
      three grades, so the deadline is roughly January, not September.
- [x] Practice progress — save-code system. localStorage primary, code for portability.
- [ ] Grade 8 plan says 1.5 h/week but lists 70 lessons and is filenamed "2 ГОД". Which is it?
- [ ] Is the grid world worth building at all now that turtle is the curriculum's visual layer?
- [x] Does interactive input need SharedArrayBuffer? **No.** Verified with
      `crossOriginIsolated=false`; no COOP/COEP headers on Vercel, embeds stay possible.
- [x] Default `parsons.indentMode` per topic — `given` only for now: the authoring API rejects
      `'chosen'` and the component never renders it. Revisit once `order_equals` can grade an
      expected indent (docs/TASK_SCHEMA.md).
- [ ] Lesson 40 (grade 7) requires покрокове виконання, which the platform does not do. Cover
      with `predict`/`fix` tasks, or teach outside the platform?

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
10. ~~Remaining task types, `parsons` first~~ — done. All six types (`parsons` with
    `indentMode: 'given'`, `quiz`, `predict` with `answerMode: 'text'`, `code`, `fix`, `fill`)
    work end to end (docs/TASK_SCHEMA.md). Two partial builds remain, both documented rather than
    silently missing: parsons' `'chosen'` indent mode (`order_equals` has nowhere to read an
    expected indent from) and predict's `'choice'` mode / `imageOptions`. The shared
    task-component interface this needed (`Task` union, `TaskWorkspace` dispatching by type) is
    what made `fix` and `fill` a new branch and a new file each, not a rewrite.
11. Turtle canvas, target overlay, playback scrubber. Grid only if still justified afterwards.
12. Meta layer.

Building the authoring UI early is the standing temptation, because it feels like foundation.
It is not — it is CRUD, it takes days, and it teaches nothing about whether the core works.
