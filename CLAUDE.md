# CLAUDE.md

Entry point for Claude Code sessions on this repository.

## Read order

1. This file.
2. `docs/AI_CONTEXT.md` — architecture and decisions.
3. `docs/TASKS.md` — current state and what to pick up next.

Then, depending on the work:
- `docs/TASK_SCHEMA.md` — before touching task types, checks, the evaluator, or authoring UI.
- `docs/CURRICULUM.md` — before planning content, topics, or the execution layer.
- `docs/SPIKE.md` — the open verification questions. Nothing is built before it passes.
- `docs/design-brief-python-platform.md` — before building any student-facing screen.
- `docs/CI_CD.md` — before touching workflows, deploys, or the guardrail script.

## What this project is

A Ukrainian-language web platform teaching Python to school students aged 12–15 who are **not
motivated to learn programming**. Python runs in the browser via Skulpt. Teachers author tasks,
run graded sessions, and read results. Full description in `docs/AI_CONTEXT.md`.

## Non-negotiable rules

These exist because breaking them is expensive to undo. If a task seems to require breaking
one, stop and raise it instead of working around it.

1. **Checks are data, never code.** No JavaScript stored in the database, no `eval`, no
   `new Function`. The check evaluator must run unchanged on the server later.
2. **Python never runs on the main thread.** Only inside the Worker in `lib/runner/`.
3. **Nothing outside `lib/runner/` imports Skulpt.** The runner is behind an interface so the
   engine can be swapped.
4. **The database is touched only by route handlers and server components.**
5. **Expected results are computed by running the author's reference solution**, never typed by
   hand and never stored as an image.
6. **No exact `stdout` comparison on tasks with input.** See TASK_SCHEMA.md for why.
7. **Turtle output is compared as a normalized segment set, never as a command log.**
8. **Never store personal data about students.** A display name from a teacher-entered roster
   is the maximum. No accounts, no email, no passwords for students.

## Conventions

- Code, comments, identifiers, commit messages and all documentation: **English**.
- All user-facing strings: **Ukrainian**, in `messages/uk.json`. No Ukrainian string literals
  in components. Task content and error-humanization rules are data and are the exception.
- Design tokens are CSS custom properties; Tailwind config references them. No hard-coded hex
  values in components.
- Commit messages describe the change, nothing else.
- TypeScript strict mode. No `any` in `lib/checker/` or `lib/runner/` — these two are the parts
  that must survive being moved to the server.

## Working style

- Read the docs before proposing an approach, and say which decision you are relying on.
- When a doc contradicts the code, say so rather than silently trusting either. Stale docs and
  half-finished refactors look identical from the inside.
- Prefer finishing one vertical slice over scaffolding several layers.
- Update `docs/TASKS.md` when a chunk is done: change the status symbol, add a note, check off
  any open question the work resolved. Do not touch `docs/AI_CONTEXT.md` for routine progress —
  only when an architectural decision actually changed.
- New check kinds go into `docs/TASK_SCHEMA.md` in the same commit as their evaluator.
- Real bugs and non-obvious behaviour go into the Gotchas section of `docs/AI_CONTEXT.md`. Do
  not fill it with generic advice.

## Testing

- `lib/checker/` and `lib/seed/` are pure and must have unit tests. Seeded parameterization
  needs a test proving the same seed yields the same variant.
- `lib/runner/` needs at least one integration test per curriculum construct that actually runs
  Python: variables, arithmetic, `if`, `while`, `for`, `input`, turtle, `random`, `try/except`.
- The turtle comparison needs a test proving `right(90)` and `left(270)` both pass the same
  check. That equivalence is the whole point of the design.
- A script that re-runs every published task's reference solution against its own checks. Run
  it after any runner change.

## Current state

The spike is answered (`docs/SPIKE.md`) and Skulpt stayed. Built so far: the runner, the check
evaluator, error humanization, the database layer, practice mode, sessions, a read-only teacher
dashboard, task authoring, all six task types end to end, and lessons (mandatory/practice) with grade 7 content for lessons 25–42. Grades 8–9 content, the meta layer, and
the authoring UI's per-kind visual builder do not exist yet. `docs/TASKS.md` is the map —
read it rather than guessing from the folder tree.
