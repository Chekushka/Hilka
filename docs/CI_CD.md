# CI/CD and Remote Development

How this repository is built, checked, deployed, and how a Claude Code session
running in the cloud picks it up. Staged in three phases, because the project is
greenfield and `docs/SPIKE.md` can still change the stack.

Phase A is live now. Phase B activates the day Next.js is scaffolded. Phase C is
content-era.

---

## What is already in the repository

| Path | Phase | Purpose |
|---|---|---|
| `.claude/settings.json` | A | `SessionStart` hook + permission allowlist for remote sessions |
| `.nvmrc` | A | Node 22 — CI, Vercel, and local must agree |
| `scripts/guardrails.sh` | A | The non-negotiable rules of CLAUDE.md, as checks |
| `.github/workflows/guardrails.yml` | A | Runs the above on every PR |
| `.github/workflows/spike-pages.yml` | A | Publishes `spike/` to GitHub Pages |
| `spike/index.html` | A | Placeholder harness — replace with the real one |
| `.github/workflows-pending/ci.yml` | B | typecheck, lint, unit tests, migration drift, runner tests |
| `.github/workflows-pending/migrate.yml` | B | `drizzle-kit migrate` on merge to `main` |
| `.github/workflows-pending/reference-check.yml` | C | Re-runs every reference solution against its own checks |

Pending workflows are inert: GitHub only runs what is inside `.github/workflows/`.

---

## Manual steps — Phase A

These need repository or account access and cannot be committed.

### 1. Enable GitHub Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

Then run the `spike` workflow once (Actions → spike → Run workflow) and open the
resulting URL **on the weakest machine in the classroom, on the school network**.
Two of the six spike checks are about that machine, not about Skulpt, and they
cannot be measured on a dev laptop.

### 2. Protect `main`

Settings → Rules → Rulesets → New ruleset → **Import a ruleset**, and upload
`.github/rulesets/main.json`. It encodes:

- A pull request is required; zero approvals, so a solo merge still works.
- `guardrails` must pass.
- No deletion, no force push.
- Repository admins bypass (`actor_id: 5`) — a hotfix the night before a lesson
  stays possible. Remove the `bypass_actors` entry when a second person joins.

It targets `~DEFAULT_BRANCH` rather than the literal name, so it survives a
rename of `main`.

The file is the source of truth for a setting that otherwise lives only in the
web UI and drifts silently. Edit it, re-import, and the ruleset matches git again.

**In Phase B**, add `verify` to `required_status_checks` and re-import. Not
before: a required check that never reports blocks every merge, and the fix is
not obvious from the UI — the PR simply says it is waiting on a check that no
workflow produces.

Remote sessions push to `claude/*` branches. Protection on `main` is what makes
an agent's mistake a reviewable diff.

### 3. Configure the cloud environment for remote sessions

When creating the Claude Code environment:

- Network policy must reach the npm registry, `*.neon.tech`, and `*.vercel.app`.
- Set `DATABASE_URL` to a Neon **dev branch**, never production. A remote session
  holding production credentials is one bad `drizzle-kit push` from data loss.
- Nothing else. No Vercel token, no Neon API key: a session that cannot deploy
  cannot deploy by accident.

---

## Manual steps — Phase B (after the spike passes and Next.js exists)

### 4. Activate the pending workflows

```sh
git mv .github/workflows-pending/ci.yml      .github/workflows/
git mv .github/workflows-pending/migrate.yml .github/workflows/
git rm .github/workflows-pending/README.md
```

`ci.yml` expects these scripts in `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest",
    "test:runner": "playwright test",
    "verify:references": "tsx scripts/verify-references.ts"
  }
}
```

`test` covers `lib/checker/`, `lib/seed/`, and `lib/errors/` — pure, node
environment, no browser. `test:runner` is the browser job: it actually executes
Python in a Worker, one test per curriculum construct, plus the test proving
`right(90)` and `left(270)` pass the same `shape_equals` check.

### 5. Vercel

- Install the Vercel GitHub App on `Chekushka/Hilka`.
- Production Branch: `main`. Every other branch, `claude/*` included, gets a
  preview URL.
- Node version: 22, to match `.nvmrc`.
- Do **not** deploy from GitHub Actions with `VERCEL_TOKEN`. The Git integration
  is less machinery and contributes its own PR status check.

Preview deploys are the real deliverable of this setup. "Does the workspace read
from the back row on a washed-out 1366×768 projector" is answered by opening a
preview URL in the classroom, not by a test.

Note: Vercel Hobby forbids commercial use. A school platform you are not paid for
is fine; if money changes hands, this needs Pro before launch.

### 6. Neon

- Use Neon's Vercel integration for **branch per preview**: each PR gets its own
  database branch and `DATABASE_URL`, removed when the PR closes.
- Migrations: generated locally (`npx drizzle-kit generate`), committed under
  `drizzle/`, applied by `migrate.yml` on merge. Never at app boot — serverless
  instances start concurrently and would race.
- CI fails if a schema change is committed without its migration.

### 7. Secrets

| Where | Name | Used by |
|---|---|---|
| GitHub environment `production` | `DATABASE_URL` | `migrate.yml` |
| Cloud environment for agents | `DATABASE_URL` (Neon **dev** branch) | remote sessions |
| Repo secrets | *(none needed)* | Vercel and Neon are wired through their apps |

Create the `production` environment under Settings → Environments and add a
required reviewer. Then a migration against the real database is a button you
press, not something a merge does behind your back.

---

## Phase C — content era

Activate `reference-check.yml` once `content/seed-tasks/` holds published tasks.
It runs nightly and on any change to `lib/runner/` or `lib/checker/`.

Add to `scripts/guardrails.sh` as the schema grows; it already rejects
`stdout_equals` on any seed task that has `cases` (TASK_SCHEMA.md).

---

## The guardrails, and why each exists

`scripts/guardrails.sh` mechanizes CLAUDE.md. Each check is a search that must
find nothing; checks whose directories do not exist yet pass silently.

| Check | Rule it protects |
|---|---|
| Skulpt referenced outside `lib/runner` | The adapter boundary — the only thing that makes swapping in Pyodide possible |
| `eval` / `new Function` in checker or runner | Checks are data; the evaluator must run unchanged server-side |
| Explicit `any` in checker or runner | Same two modules, same reason |
| `lib/db` imported by a component, the runner, or the checker | Only route handlers and server components touch the database |
| Cyrillic literal in a component | User-facing text belongs in `messages/uk.json` |
| Hard-coded hex in a component | Colours come from the CSS custom properties |

Run it locally with `bash scripts/guardrails.sh`.

These are the rules that get broken silently at 2am by a session that is
otherwise doing good work. A failing check is cheaper than finding out three
commits later.
