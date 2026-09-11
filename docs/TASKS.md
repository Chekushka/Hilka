# TASKS

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Fully implemented, no TODOs remaining |
| 🔶 | Partial — some parts done, some still TODO |
| ❌ | Not started |

## Spike (do this before anything else) — see SPIKE.md

Six checks, one static HTML page, no framework. Record results in SPIKE.md, then copy the
outcome here.

| Item | Status | Notes |
|---|---|---|
| 1. Language coverage | ❌ | f-strings, dict methods, `enumerate`/`zip`, slicing, `try/except`, Cyrillic |
| 2. Turtle module replaceable by a recording stub | ❌ | Curriculum-critical. Skulpt's own renderer is not used. |
| 3. `input()` in a Worker, queued and interactive | ❌ | Whole of grade 8 depends on it. Watch for a SharedArrayBuffer requirement. |
| 4. Timeout that pauses while waiting for input | ❌ | A slow typist must not get "program stopped responding" |
| 5. Error shape — type, line, column, message text | ❌ | Record the exact `str + int` message; it becomes error rule #1 |
| 6. Classroom machine: cold load, memory, 200 segments | ❌ | 4 GB RAM, school network, not the dev machine |

## Infrastructure

| Item | Status | Notes |
|---|---|---|
| Next.js + TypeScript scaffold | ❌ | |
| Vercel project + preview deploys | ❌ | |
| Neon database + connection | ❌ | Measure cold start on first request of a session |
| Drizzle schema + first migration | ❌ | Schema in AI_CONTEXT.md |
| Design tokens as CSS vars + Tailwind mapping | ❌ | Blocked on design deliverable |

## CI/CD and Remote Development

See CI_CD.md. Phase A is live; phase B activates with the Next.js scaffold.

| Item | Status | Notes |
|---|---|---|
| Docs in the repository | ✅ | A cloud session clones the repo; without these it starts blind |
| `SessionStart` hook + permission allowlist | ✅ | `.claude/settings.json`; no-op until `package.json` exists |
| Guardrail script + workflow | ✅ | CLAUDE.md rules 1, 3, 4 and the convention rules, as checks |
| GitHub Pages deploy of `spike/` | 🔶 | Workflow committed; Pages source must be switched on in repo settings |
| Spike harness itself | ❌ | `spike/index.html` is a placeholder — see SPIKE.md |
| Branch protection on `main` | ❌ | Manual; required before agents open PRs |
| `ci.yml` — typecheck, lint, tests, migration drift | 🔶 | Staged in `.github/workflows-pending/` |
| `migrate.yml` — Drizzle on merge | 🔶 | Staged; needs the `production` GitHub environment |
| `reference-check.yml` — references vs their own checks | 🔶 | Staged; needs published seed tasks |
| Vercel Git integration + preview deploys | ❌ | Manual; previews are how the design gets tested on classroom hardware |
| Neon branch-per-preview | ❌ | Manual, via the Neon Vercel integration |

## Python Runner

| Item | Status | Notes |
|---|---|---|
| `PythonRunner` interface | ❌ | Nothing outside `lib/runner/` imports Skulpt |
| Skulpt worker adapter | ❌ | Timeout, termination, stdout capture |
| Interactive input line in the output panel | ❌ | Real prompt/response, no modal. PyPizza must actually work. |
| Headless run with queued `stdin` per case | ❌ | Used by Check; one run per RunCase |
| Timeout paused across input suspensions | ❌ | |
| `turtle` module stub (records, draws nothing) | ❌ | Primary visual layer. Skulpt's renderer is not used — it needs DOM. |
| Segment log + source-line attribution | ❌ | Line number optional; falls back to call order |
| Canvas renderer (student + translucent target, one renderer) | ❌ | Guarantees identical scale and theme |
| Playback scrubber with line highlighting | ❌ | Covers grade 7 lesson 40 without an interpreter stepper |
| `random` module stub with deterministic seeding in headless mode | ❌ | Grade 9. Otherwise random programs are uncheckable. |
| Grid API (`move`/`turn`/`take`) + action log | ❌ | Optional, after turtle, only if still justified |

## Checker

| Item | Status | Notes |
|---|---|---|
| Declarative check evaluator | ❌ | Isomorphic. Must run unchanged on the server later. |
| Check kinds: choice/text/order | ❌ | No Python execution needed — do these first |
| Check kinds: stdout/var/expr | ❌ | Needs the runner |
| Check kinds: `shape_equals` / `shape_contains` / `shape_props` | ❌ | Normalized segment sets. `right(90)` ≡ `left(270)` — needs a test. |
| Check kinds: `number_close` / `numbers_equal` / `last_line_equals` | ❌ | Input-driven tasks. Prompt text is ignored. |
| Check kinds: `uses` / `forbids` (AST-based) | ❌ | Must not match identifiers or string literals |
| Reference-solution execution + artifact computation | ❌ | Publish is rejected if the reference fails its own checks |
| `stdout_equals` blocked on tasks with cases | ❌ | Enforce in the authoring UI, not by convention |
| Parameterized variants + seeded PRNG | ❌ | `hash(session_id + student_name + task_id)` |

## Task Types

| Item | Status | Notes |
|---|---|---|
| Shared task-component interface | ❌ | Adding a type must not touch runner/session/dashboard |
| `code` | ❌ | Build first — proves the whole vertical slice |
| `quiz` | ❌ | |
| `predict` | ❌ | |
| `parsons` | ❌ | Highest-value type for the target audience. dnd-kit, keyboard-accessible. |
| `fill` | ❌ | |
| `fix` | ❌ | |

## Error Humanization

| Item | Status | Notes |
|---|---|---|
| `PyError` → Ukrainian message mapping | ❌ | Rule-based; generic calm fallback, never a raw traceback |
| Rule #1: arithmetic on `input()` result | ❌ | Most common mistake of grade 8. Must never reach a student as a traceback. |
| Starter rule set | ❌ | NameError, SyntaxError, IndentationError, TypeError, IndexError, ZeroDivisionError |
| Timeout message phrased as "did not finish", not as an error | ❌ | |
| Unmatched-error logging | ❌ | Feeds rule-base growth from real classroom data |

## Student Flow

| Item | Status | Notes |
|---|---|---|
| Practice mode (localStorage progress) | ❌ | Primary store; no server round-trip to resume on the same machine |
| Progress codes: mint, restore, merge | ❌ | 8 chars, unambiguous alphabet, rate-limited entry, merge-not-replace |
| Join by 6-char code | ❌ | Code must be legible from the back row on a projector |
| Name selection from roster | ❌ | No password, no email |
| Task runner shell (three-zone layout) | ❌ | Blocked on design |
| Loading state for Skulpt | ❌ | Required — several seconds on weak hardware |
| Exam mode: timer, no hints, single submit | ❌ | |

## Teacher Flow

| Item | Status | Notes |
|---|---|---|
| Magic-link auth | ❌ | ~5 accounts total; anything heavier is over-engineering |
| Task authoring UI | ❌ | All six types + checks + hints. Big and unglamorous — do not defer past sprint 2. |
| Draft / publish + version bump | ❌ | Publishing is what students see; drafts are invisible |
| Class + roster management | ❌ | Roster is a plain string array |
| Session builder | ❌ | Filter by topic and grade tag, set limit and hint availability |
| Results dashboard | ❌ | Poll every 10 s; no realtime in v1 |
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
| Grade 7 sem-2 block: intro → loops-for + turtle-basics | ❌ | ~9 topics. First thing that reaches a classroom. |
| First topic, ~12 tasks | ❌ | Progression: quiz → predict → parsons → fill → code |
| Grade tagging of tasks | ❌ | |

## Open Questions

- [x] Hosting — Vercel Hobby + Neon. Hetzner only if server-side execution is added.
- [x] Offline support — dropped. Online-only, accessible from anywhere.
- [x] Skulpt vs Pyodide — Skulpt for v1, behind an adapter. Revisit if the spike fails.
- [x] Task storage — database as source of truth, with JSON export to git.
- [x] Visual style — cozy; tool-like workspace, game-like reward layer.
- [ ] Grade→score mapping to the 12-point scale — needs a teacher's decision, not a default.
- [ ] Is a graded attempt final on first submit, or best-of-N? Affects the attempts query and
      the exam UI.
- [ ] Does the advanced branch share a topic with the main track or sit in a separate one?
- [x] Curriculum — supplied and mapped in CURRICULUM.md. Programming runs in semester 2 in all
      three grades, so the deadline is roughly January, not September.
- [x] Practice progress — save-code system. localStorage primary, code for portability.
- [ ] Grade 8 plan says 1.5 h/week but lists 70 lessons and is filenamed "2 ГОД". Which is it?
- [ ] Is the grid world worth building at all now that turtle is the curriculum's visual layer?
- [ ] Does interactive input need SharedArrayBuffer? If yes, COOP/COEP headers on Vercel, which
      affects embeds. Answered by SPIKE.md check 3.
- [ ] Default `parsons.indentMode` per topic — `given` first, `chosen` later, but where exactly?
- [ ] Lesson 40 (grade 7) requires покрокове виконання, which the platform does not do. Cover
      with `predict`/`fix` tasks, or teach outside the platform?

## Recommended Implementation Order

1. **Spike (SPIKE.md).** Static page, worst machine in the classroom. Everything below assumes
   it passes. Do not scaffold Next.js first — the results can change the stack.
2. Runner adapter + Worker + timeout + module stubs (`turtle`, `random`).
3. Checker evaluator with the non-Python check kinds.
4. One `code` task, hard-coded, end to end: prompt → editor → run → check → result. This is the
   vertical slice that proves the stack. Make it a turtle task — it exercises the stub, the
   segment log, the renderer, and `shape_equals` at once.
5. Error humanization, starter rule set. Do this before adding task types — it changes how
   results are displayed everywhere.
6. Database + Drizzle schema, task loaded from the DB instead of hard-coded.
7. Session create/join/submit + attempts.
8. Teacher dashboard, read-only first.
9. Task authoring UI.
10. Remaining task types, `parsons` first.
11. Turtle canvas, target overlay, playback scrubber. Grid only if still justified afterwards.
12. Meta layer.

Building the authoring UI early is the standing temptation, because it feels like foundation.
It is not — it is CRUD, it takes days, and it teaches nothing about whether the core works.
