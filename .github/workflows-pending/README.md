# Pending workflows

GitHub only runs workflows found in `.github/workflows/`. These three live here
because they need a `package.json`, which does not exist yet — the spike comes
first (`docs/SPIKE.md`), and its results can still change the stack.

Activate them the day Next.js is scaffolded:

```sh
git mv .github/workflows-pending/ci.yml               .github/workflows/
git mv .github/workflows-pending/migrate.yml          .github/workflows/
git mv .github/workflows-pending/reference-check.yml  .github/workflows/
git rm .github/workflows-pending/README.md
```

Then add `verify` and `guardrails` to the required status checks on `main`, and
create the `production` GitHub environment holding `DATABASE_URL`.

An empty CI that can never fail teaches everyone — people and agents — to ignore
a red X. That is the only reason these are staged rather than merged now.
