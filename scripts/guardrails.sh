#!/usr/bin/env bash
# Architectural guardrails — the non-negotiable rules of CLAUDE.md, as checks.
#
# Each rule is expressed as a search that MUST find nothing. A check whose
# target directories do not exist yet passes silently, so this script is safe
# to run from the spike phase onward.
#
# Run locally: bash scripts/guardrails.sh
set -uo pipefail

fail=0

# check <description> <command...>   — fails if the command prints anything
check() {
  local desc="$1"; shift
  local out
  if out=$("$@" 2>/dev/null) && [ -n "$out" ]; then
    printf '::error::%s\n%s\n\n' "$desc" "$out"
    fail=1
  fi
}

exists() { [ -e "$1" ]; }

# --- rule 3: nothing outside lib/runner imports Skulpt ------------------------
# Matches code, not prose. lib/errors/ has to name Skulpt in its comments — its
# rules match on Skulpt's own message wording, which is not CPython's — and that
# coupling is documented in AI_CONTEXT.md rather than hidden. What must never
# happen is another module reaching for the engine itself.
if exists lib || exists app || exists components; then
  check "Skulpt imported or used outside lib/runner — the runner must stay behind its interface (CLAUDE.md rule 3)" \
    grep -rnE "(from|require\()[[:space:]]*['\"][^'\"]*skulpt|importScripts\([^)]*skulpt|\bSk\.[A-Za-z]" \
      --include=*.ts --include=*.tsx \
      --exclude-dir=runner --exclude-dir=node_modules \
      app components lib
fi

# --- rule 1: checks are data, never code -------------------------------------
if exists lib/checker || exists lib/runner; then
  check "eval / new Function in checker or runner — checks are data and the evaluator must run unchanged on the server (CLAUDE.md rule 1)" \
    grep -rnE "\beval\(|new Function\(" lib/checker lib/runner

  check "explicit 'any' in checker or runner — these two must survive being moved server-side (CLAUDE.md conventions)" \
    grep -rnE ":[[:space:]]*any\b" --include=*.ts lib/checker lib/runner
fi

# --- rule 4: the database is touched only by route handlers / server components
if exists components || exists lib/runner || exists lib/checker; then
  check "database imported from a client component, the runner, or the checker (CLAUDE.md rule 4)" \
    grep -rln "lib/db" --include=*.ts --include=*.tsx \
      components lib/runner lib/checker
fi

# --- conventions: user-facing Ukrainian lives in messages/uk.json ------------
if exists app || exists components; then
  # \p{Cyrillic} needs both PCRE support and a UTF-8 locale, hence the probe.
  if printf '\xd1\x96\n' | env LC_ALL=C.UTF-8 grep -qP "\p{Cyrillic}" 2>/dev/null; then
    check "Ukrainian string literal in a component — user-facing text belongs in messages/uk.json (CLAUDE.md conventions)" \
      env LC_ALL=C.UTF-8 grep -rnP "\p{Cyrillic}" --include=*.tsx --include=*.ts app components
  else
    echo "::warning::grep -P with a UTF-8 locale unavailable; skipping the Cyrillic-literal check locally (it still runs in CI)"
  fi

  check "hard-coded colour in a component — use the CSS custom properties (CLAUDE.md conventions)" \
    grep -rnE "#[0-9a-fA-F]{6}\b" --include=*.tsx --include=*.ts app components
fi

# --- TASK_SCHEMA rule: stdout_equals is banned on tasks with cases -----------
if exists content/seed-tasks; then
  for f in content/seed-tasks/*.json; do
    [ -e "$f" ] || continue
    if grep -q '"cases"' "$f" && grep -q '"stdout_equals"' "$f"; then
      printf '::error::%s\n' "stdout_equals used on a task that has cases: $f (TASK_SCHEMA.md — prompt wording varies between correct solutions)"
      fail=1
    fi
  done
fi

if [ "$fail" -eq 0 ]; then
  echo "guardrails: clean"
fi
exit "$fail"
