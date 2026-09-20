# Pending workflows

GitHub only runs workflows found in `.github/workflows/`. This one lives here
because it needs the `production` GitHub environment holding `DATABASE_URL`,
which cannot be committed.

- `migrate.yml` — activate with that environment in place (docs/CI_CD.md,
  "Manual steps — Phase B", step 7).

```sh
git mv .github/workflows-pending/migrate.yml .github/workflows/
```

`ci.yml` and `reference-check.yml` are both live already. An empty CI that can
never fail teaches everyone — people and agents — to ignore a red X. That is
the only reason this one is staged rather than merged now.

`neon-branch-cleanup.yml` moved to `.github/workflows/` already, but is not
yet operational — see the "not yet operational" note at its own top, and
docs/CI_CD.md's "Neon branch cleanup", for what is still missing
(`NEON_PROJECT_ID`/`NEON_API_KEY` secrets, and confirming its guessed
branch-name pattern against a real branch in the Neon console).
