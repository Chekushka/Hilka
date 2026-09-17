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
