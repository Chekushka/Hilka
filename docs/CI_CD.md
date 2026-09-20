# CI/CD and Remote Development

How this repository is built, checked, deployed, and how a Claude Code session
running in the cloud picks it up. Staged in three phases, because the stack was
not settled until `docs/SPIKE.md` was answered.

Phases A and B are live: CI runs on every PR and the app deploys to Vercel
against a Neon database. What remains of B is the `production` GitHub
environment that gates `migrate.yml`. Phase C is content-era and waits on
published tasks.

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
| `.github/workflows/ci.yml` | B | typecheck, lint, unit tests, migration drift, runner tests |
| `.github/workflows-pending/migrate.yml` | B | `drizzle-kit migrate` on merge to `main` |
| `.github/workflows/reference-check.yml` | C | Re-runs every reference solution against its own checks |

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
  Put it in the environment's settings, not in a message to the session — a
  connection string pasted into a conversation is a credential in a transcript,
  and Neon role passwords are project-scoped rather than per-branch, so a
  dev-branch string is not a dev-only secret.
- Nothing else. No Vercel token, no Neon API key: a session that cannot deploy
  cannot deploy by accident.

Checked on 2026-09-15 and **not yet true**: the environment's policy blocked
both `hilka.vercel.app` and `*.neon.tech`, so a session cannot open a preview to
check a deploy or query the database, and has to ask a human what the live site
shows. Widen the policy before relying on either.

---

## Manual steps — Phase B (done, except where noted)

### 4. Activate the pending workflows

`ci.yml` is live. `migrate.yml` moves across once the `production` environment
exists (step 7):

```sh
git mv .github/workflows-pending/migrate.yml .github/workflows/
```

The workflows call these scripts, which `package.json` already defines:
`typecheck`, `lint`, `test`, `test:browser`, `db:generate`, `db:migrate`,
`db:seed`, `verify:references`.

`verify:references` runs against `playwright.references.config.ts`, not the
shared `playwright.config.ts` — the shared one waits for `/practice`, which
reads a task from the database, and this run is specifically the one meant to
work with no `DATABASE_URL` at all (`lib/checker/reference-check.ts` reads
`content/seed-tasks/*.json` directly and drives the real runner through
`/runner`, the same DB-free page `tests/runner/` uses).

`test` covers `lib/checker/`, `lib/seed/`, `lib/errors/` and `lib/db/`'s pure
mapping — node environment, no browser, no database. `test:browser` is the
browser job: it actually executes Python in a Worker, one test per curriculum
construct, plus the test proving `right(90)` and `left(270)` pass the same
`shape_equals` check.

The browser job also runs a `postgres:16` service, applies the migrations and
seeds `content/`: the workspace reads its task from the database, so without
one `/practice` is a 404 and every end-to-end test fails. Nothing there is
Neon-specific — the app speaks plain Postgres.

The migration-drift step regenerates migrations and fails if anything new
appears. A schema edit committed without its migration is otherwise invisible
until a deploy runs against the old tables.

### Working on the database locally

```sh
createdb hilka
export DATABASE_URL=postgres://localhost/hilka
npm run db:migrate    # apply drizzle/
npm run db:seed       # import content/topics.json and content/seed-tasks/
npm run db:seed:demo  # one demo teacher/class/open session, for the join and dashboard flows
```

Teacher login also needs `export AUTH_SECRET=<anything>` — it signs the cookie that marks a
request as logged in (`lib/auth/session-cookie.ts`). Any string works locally; there is no
format requirement, only that it stays the same across restarts or existing cookies stop
verifying.

After editing `lib/db/schema.ts`, run `npm run db:generate` and commit what it
writes under `drizzle/` in the same commit as the schema change. Never
`drizzle-kit push` against anything but a throwaway database — it applies
differences without recording a migration, and the drift check will then fail
for everyone else.

### 5. Vercel

**Live at <https://hilka.vercel.app>.** Production branch `main`; every other
branch, `claude/*` included, gets a preview URL. The Vercel GitHub App is
installed on `Chekushka/Hilka` and contributes its own PR status check.

The project settings that matter, and what goes wrong when they are wrong:

| Setting | Value | Why |
|---|---|---|
| Framework preset | Next.js | Auto-detected |
| Root Directory | `./` | No `src/`, no monorepo |
| Build Command | **default** — do not override | The default runs `npm run build`, which is `sync:skulpt && next build`. `sync:skulpt` copies Skulpt into `public/runner/`, which is gitignored and therefore only exists if the script runs. Override it with a bare `next build` and the Worker 404s on the engine: the page loads and «Готую Python…» never goes away |
| Install Command | **default** (`npm ci`) | Not `--omit=dev` — the build needs TypeScript and the `@types` packages |
| Node.js Version | **22.x** | Matches `.nvmrc`, which Vercel does not reliably read. This dropdown, or `engines.node`, is what actually decides |
| Function Region | **`fra1`** (Frankfurt) | Must equal the Neon region. Every `/practice` request is a database round trip made server-side, so a region mismatch costs more than the distance from Kyiv to the function. Hobby allows one region; the default is `iad1` |
| Environment Variables | `AUTH_SECRET` set by hand; `DATABASE_URL` from the Neon integration (step 6) | `AUTH_SECRET` has no integration to inject it — generate one (`openssl rand -hex 32`) and add it to Production, Preview and Development in Vercel's project settings. Without it, `lib/auth/session-cookie.ts` throws on the first request that touches a teacher cookie — fails closed with a 500, never a silent open door |
| Deployment Protection | decide deliberately | Standard Protection is **on by default** and puts a Vercel login in front of every preview URL. See below |

**Variables attach to a deployment when it is built.** A deployment created
before the Neon integration existed keeps running without `DATABASE_URL` — so
after linking Neon, redeploy production once. This looks exactly like a broken
database and is not one.

**Deployment Protection versus the classroom.** Preview deploys are the real
deliverable of this setup: "does the workspace read from the back row on a
washed-out 1366×768 projector" is answered by opening a preview URL on the
school's own machine, not by a test. That machine is not logged into Vercel, so
with Standard Protection on it sees a login wall. Either turn Vercel
Authentication off, or share each preview through a sharable link from the
deployment's ⋯ menu. Production on `*.vercel.app` is unaffected either way.

Do **not** deploy from GitHub Actions with `VERCEL_TOKEN`. The Git integration is
less machinery and reports its own status check.

Note: Vercel Hobby forbids commercial use. A school platform you are not paid for
is fine; if money changes hands, this needs Pro before launch.

### 6. Neon

Project in **AWS eu-central-1 (Frankfurt)**, matching the Vercel function region.

**Linking.** Neon Console → Integrations → Vercel → Install from Vercel
Marketplace. Use the **Neon-managed** integration, not the Marketplace-billed
one: the database then stays on Neon's own plan and branching stays in Neon's
console. Enable *"Create a branch for each preview deployment"* — each PR gets
its own database branch, removed when the PR closes. The integration writes
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` (plus legacy `PG*`) into Production
and Development, and injects a per-deployment pair for previews. Delete any
hand-made `DATABASE_URL`/`PGHOST`/`PGUSER`/`PGDATABASE`/`PGPASSWORD` first, or
it refuses with "Failed to set environment variables".

**Pooled or unpooled.** `lib/db/client.ts` keeps a `pg` pool, so the runtime
wants the **pooled** string (`-pooler` in the host) — which is what the
integration sets. Anything running DDL wants the **unpooled** one: schema
changes through a transaction pooler misbehave.

**Bootstrapping an empty database** — once per database, from a machine with the
repo checked out:

```sh
DATABASE_URL=<unpooled> npm run db:migrate   # [✓] migrations applied successfully!
DATABASE_URL=<unpooled> npm run db:seed      # topics: 13 / task: g7-turtle-square (published)
```

Then redeploy production, per the variable-attachment note in step 5. Until both
have run, `/practice` is a 500 (no tables) or the «Тут поки що порожньо» page (no
published task) — the two failure modes look different, which is how you tell
which step is missing.

**Branches are copy-on-write copies of their parent at the moment they are
made.** Create the dev branch *after* seeding production and it already has the
schema and the content; create it before, and it is empty forever.

**Role passwords are project-scoped, not per-branch.** A dev-branch connection
string opens production too, given the production host. Rotate under Roles →
Reset password, then update the Vercel variable and redeploy.

**Neon branch cleanup.** The Free plan caps a project at **10 branches total**,
and the Neon-Managed integration does not free one up just because its PR
merged. It creates one branch per git branch (named `preview/<git-branch>`,
reused across every push to that PR — not one new branch per push), which
only gets deleted when *both*: the git branch itself is gone (merging a PR
does not delete its branch unless GitHub's own "Automatically delete head
branches" repo setting is on), and Neon's own "Automatically delete obsolete
Neon branches" is enabled on the Vercel connection (Neon Console →
Integrations → Vercel) — and even then, cleanup only runs on the *next*
preview deployment, not the moment the git branch disappears. Any one of
those three conditions being off is enough for branches to accumulate past
10 with just a handful of PRs.

To fix:
1. **Unblock now** — Neon Console → Branches → delete the `preview/*`
   branches for PRs that are already merged or closed.
2. **Turn on both dashboard toggles**: GitHub repo Settings → General →
   Pull Requests → *Automatically delete head branches*; and Neon Console →
   Integrations → Vercel connection → *Automatically delete obsolete Neon
   branches*.
3. **Optional backstop, independent of either toggle**:
   `.github/workflows-pending/neon-branch-cleanup.yml` deletes a PR's Neon
   branch the instant it closes via `neondatabase/delete-branch-action`.
   Needs `NEON_PROJECT_ID` and `NEON_API_KEY` as repo secrets (a Neon API
   key scoped to CI secrets, not the remote-agent environment — a different
   trust boundary from step 3's "no Neon API key for agents" rule) — see
   `.github/workflows-pending/README.md` before activating it.

**Migrations after the first** are generated locally (`npm run db:generate`),
committed under `drizzle/`, and applied by `migrate.yml` on merge. Never at app
boot — serverless instances start concurrently and would race. CI fails if a
schema change is committed without its migration.

**`pg` and `sslmode=require`.** Connecting prints a warning: `pg` currently
treats `sslmode=require` as `verify-full`, and in `pg` v9 it will fall back to
libpq semantics, which verify nothing. Harmless today; when that upgrade lands,
the connection strings need `sslmode=verify-full` or the platform silently stops
verifying Neon's certificate.

### 7. Secrets

| Where | Name | Used by |
|---|---|---|
| GitHub environment `production` | `DATABASE_URL` | `migrate.yml` |
| Cloud environment for agents | `DATABASE_URL` (Neon **dev** branch) | remote sessions |
| Repo secrets | *(none needed)* | Vercel and Neon are wired through their apps |
| Vercel project settings | `AUTH_SECRET` | teacher login (`lib/auth/session-cookie.ts`) — no integration sets this one, see step 5 |
| `.github/workflows/ci.yml` | `AUTH_SECRET` (throwaway, hard-coded) | the `browser` job only; not a real secret, just needs to be *some* value |

Create the `production` environment under Settings → Environments and add a
required reviewer. Then a migration against the real database is a button you
press, not something a merge does behind your back.

---

## Phase C — content era

`reference-check.yml` is active: `content/seed-tasks/` holds one published
task and `verify:references` exists. It runs nightly and on any change to
`lib/runner/`, `lib/checker/`, or `content/seed-tasks/`.

Add to `scripts/guardrails.sh` as the schema grows; it already rejects
`stdout_equals` on any seed task that has `cases` (TASK_SCHEMA.md).

---

## The guardrails, and why each exists

`scripts/guardrails.sh` mechanizes CLAUDE.md. Each check is a search that must
find nothing; checks whose directories do not exist yet pass silently.

| Check | Rule it protects |
|---|---|
| Skulpt imported or used outside `lib/runner` | The adapter boundary — the only thing that makes swapping in Pyodide possible. Matches code, not comments: `lib/errors/` has to discuss Skulpt's wording |
| `eval` / `new Function` in checker or runner | Checks are data; the evaluator must run unchanged server-side |
| Explicit `any` in checker or runner | Same two modules, same reason |
| `lib/db` imported by a component, the runner, or the checker | Only route handlers and server components touch the database |
| Cyrillic literal in a component | User-facing text belongs in `messages/uk.json` |
| Hard-coded hex in a component | Colours come from the CSS custom properties |

Run it locally with `bash scripts/guardrails.sh`.

These are the rules that get broken silently at 2am by a session that is
otherwise doing good work. A failing check is cheaper than finding out three
commits later.
