# Pending workflows

GitHub only runs workflows found in `.github/workflows/`. These three live here
because they need a `package.json`, which does not exist yet — the spike comes
first (`docs/SPIKE.md`), and its results can still change the stack.

`ci.yml` is live as of the Next.js scaffold. These two are still waiting:

- `migrate.yml` — activate with the Drizzle schema. Needs the `production`
  GitHub environment holding `DATABASE_URL`.
- `reference-check.yml` — activate once `content/seed-tasks/` holds published
  tasks and `npm run verify:references` exists.

```sh
git mv .github/workflows-pending/<file> .github/workflows/
```

An empty CI that can never fail teaches everyone — people and agents — to ignore
a red X. That is the only reason these are staged rather than merged now.
