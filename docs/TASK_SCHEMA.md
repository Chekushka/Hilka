# Task Schema — Data Contract

The single source of truth for task payloads, checks, run cases, and parameterization. The
authoring UI, the checker evaluator, and the task components all conform to this file. Any new
check kind is added here in the same commit as its evaluator.

## Task

```ts
interface Task {
  id: string;                  // uuid, assigned by the database
  slug: string;                // stable content key, e.g. 'g7-turtle-square'
  topicId: string;
  type: TaskType;
  title: string;
  payload: Payload;            // type-specific, below
  checks: Check[];             // all must pass
  cases?: RunCase[];           // input-driven tasks; one run per case
  reference?: Reference;       // required for every task that executes Python
  hints: string[];             // ordered, progressively more explicit
  params?: ParamSpec;          // parameterized variants
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];         // e.g. [7, 8]
  version: number;
  status: 'draft' | 'published' | 'archived';
}

type TaskType = 'quiz' | 'predict' | 'parsons' | 'fill' | 'code' | 'fix';
```

A task passes when **every** check passes, for **every** case. With no `cases`, the code is run
once with no stdin.

### As content in git

`content/seed-tasks/*.json` is the export format and the handoff format, and `npm run db:seed`
imports it. A content file carries `slug` and `topicSlug` instead of `id` and `topicId` — uuids
belong to one database and mean nothing in another — and the importer resolves the topic and
rejects a file whose checks fail `validateTaskChecks`. Topics themselves are in
`content/topics.json`.

## Payloads

```ts
type Payload =
  | { type: 'quiz';    prompt: string; options: string[]; multiple: boolean }

  | { type: 'predict'; prompt: string; code: string;
      answerMode: 'text' | 'choice';
      options?: string[];        // text options
      imageOptions?: number;     // N reference variants rendered as pictures (turtle)
    }

  | { type: 'parsons'; prompt: string;
      lines: { text: string; indent: number }[];
      distractors?: string[];
      indentMode: 'given' | 'chosen';   // 'chosen' = student sets indentation too
    }

  | { type: 'fill';    prompt: string; template: string }   // gaps as {{1}}, {{2}}

  | { type: 'code';    prompt: string; starter: string;
      surface: 'console' | 'turtle' | 'grid';
      delivery?: 'inline' | 'file'; file?: FileSpec }   // delivery default 'inline'

  | { type: 'fix';     prompt: string; broken: string;
      surface: 'console' | 'turtle' | 'grid';
      delivery?: 'inline' | 'file'; file?: FileSpec }   // delivery default 'inline'
```

`code` and `fix` execute Python. `fill` executes Python after substitution. `quiz`, `predict`
(text/choice mode), and `parsons` do not execute anything and stay instant on weak hardware.

`delivery: 'file'` is only meaningful on `code` and `fix` — see "File Delivery" below. It is
invalid on `quiz`, `predict`, `parsons`, and `fill`; the authoring API rejects it there. `fill`
in particular already executes Python after substitution, but the substitution *is* the
editing surface, so there is no separate file to hand out.

Notes:
- `parsons.indentMode: 'chosen'` is the harder variant and the only one that teaches Python
  indentation. Default to `'given'` for a topic's first Parsons task and `'chosen'` later. Every
  line starts flat in `components/task-types/ParsonsTaskView.tsx`; the student sets each one's
  indent with Indent/Outdent buttons on the answer row, graded by `order_equals`'s
  `checkIndent`/`indents` against `payload.lines[i].indent` — the same value that already IS the
  correct answer either way (`lib/task/parsons.ts`'s `parsonsCanonicalSubmission`).
- `predict.imageOptions` renders N turtle reference programs as pictures and asks which one the
  shown code produces. The author writes N short programs; the platform renders them. No
  hand-drawn assets anywhere.
- `predict.answerMode: 'choice'` picks one of `options` — the candidate predicted outputs —
  graded with a single `choice_equals` check, same mechanism as `quiz`'s single-answer mode.
  `payload.code` IS the reference solution either way; in choice mode the publish gate both
  confirms `choice_equals` is structurally sound (exactly one index, in range —
  `lib/task/predict.ts`'s `validatePredictChoiceChecks`) and runs the code once to confirm the
  chosen option's own text actually equals its real stdout
  (`lib/checker/reference-check.ts`'s `evaluatePredictionChoiceAgainstOwnRun`) — the same rule 5
  guarantee text mode gets from `evaluatePredictionAgainstOwnRun`, applied to a chosen option
  instead of a typed string. `components/task-types/PredictTaskView.tsx` renders radio options
  instead of a text input when `answerMode === 'choice'`.
- **Not built**: `predict.imageOptions`. Its data shape — where the N reference programs
  themselves would be stored on the payload — is not decided yet, so there is nothing to author
  or render for it.

## File Delivery

Not a seventh task type. `delivery: 'file'` on `code` or `fix` changes how the student receives
and returns the code; the same `Check[]` and `RunCase[]` grade it, through the same runner.
`lib/checker/` does not know delivery mode exists. Full rationale is in AI_CONTEXT.md's "File
Delivery" section; this is the data contract.

```ts
interface FileSpec {
  filename: string;        // expected name, e.g. "bmi.py"
  headerComment: boolean;  // inject taskId/version/seed header
  maxBytes: number;        // default 65536
}
```

### Starter file generation

For a file-delivery task, the download the student receives is generated, never hand-authored:

1. A header comment, present when `file.headerComment` is true, carrying `taskId`, `version`,
   and `seed` — the same triple that already identifies an attempt. It is a plain `#`-comment
   block, not metadata IDLE would choke on.
2. The task text (`payload.prompt`), as comments, so the file is self-contained once it leaves
   the browser tab.
3. `payload.starter` (for `code`) or `payload.broken` (for `fix`), unchanged.

The header's machine lines are `# hilka-task: <taskId>`, `# hilka-version: <n>` and, only when
the server resolved a seed, `# hilka-seed: <n>`, preceded by one Ukrainian line asking the student
not to edit them (`lib/task/file.ts`). They are read only from the file's leading comment block.
The browser never learns a parameterized task's seed (the session route resolves it server-side
and strips `params`), so a file downloaded from the task view carries no seed line today.

The header is what makes the upload path able to identify which task a returned file belongs to
without the student typing anything. See "Upload validation" step 8 for what happens when it is
missing or edited.

### Upload validation

Applied in order, top to bottom, first failing step wins. Every rejection is phrased as an
instruction for what to do next, never as a verdict on the student's code — the student did
nothing wrong by working in IDLE, which is the point of the mode.

| # | Check | Outcome |
|---|---|---|
| 1 | Extension is not `.py` | Reject, with a named message asking for the `.py` file saved from IDLE |
| 2 | Content is binary / not text (`.docx`, `.zip`, `.pdf` renamed to `.py`, etc.) | Reject, with a named message asking to save as plain text from IDLE, not another program |
| 3 | Encoding is not UTF-8 | Try `cp1251` (the common Windows-Ukrainian fallback); if that decodes cleanly, accept with a warning shown to the student |
| 4 | UTF-8 BOM present | Strip silently |
| 5 | CRLF line endings | Normalize to `\n` silently |
| 6 | File exceeds `file.maxBytes` (default 65536) | Reject, with a named message |
| 7 | Filename differs from `file.filename` | Accept, with a warning — content is what is graded, the name is a convenience for the student's own folder |
| 8 | Header comment missing or altered (its `taskId`/`version`/`seed` unparseable) | Fall back to manual task selection — the student is shown a picker rather than told the file is broken, because a missing header is at least as likely to be a copy-paste as tampering |
| 9 | Parsed AST contains a construct outside the safe subset (below) | Reject as `FILE_UNSUPPORTED` (below) |

Steps 4–5 run before step 6's byte count, since a BOM and CRLF padding are not part of what the
student wrote. Step 9 runs last because it is the only check that requires a successful parse,
which steps 1–3 exist to guarantee.

Steps 1–8 are `lib/task/file.ts`'s `validateUpload`. Two implementation choices: step 2 is "starts
with a zip/PDF/OLE/PNG/JPEG signature, or contains a NUL byte"; step 5 also normalizes a bare
`\r`. Step 8's picker only applies where the task is not already known — uploading from inside a
task's own screen already names the task, so there a missing or altered header is a quiet note
and a header naming a *different* task is a warning; the file is graded against the open task
either way. Step 9 is not built yet.

### Safe subset (v1)

Automatic rewriting of student code is rejected outright: checking code the student did not
write destroys trust in the grade. Instead, v1 restricts what a file-delivery task may require —
an allow-list confirmed empirically in SPIKE.md check 1, not assumed from documentation. A
construct outside this list fails upload validation step 9, never silently produces a wrong
result.

Confirmed, from SPIKE.md check 1: f-strings, including the `.2f` format spec and the `!r`
conversion flag, dict `.items()`/`.keys()`/
`.values()`, `enumerate`, `zip`, slicing (including `[::-1]`), `str.split`/`str.join`,
`sorted(reverse=...)`, `max`/`min`/`sum`/`len`, the `math` and `random` modules, `try`/`except`,
and Cyrillic in strings, `print`, f-strings, `len`, and `input()` prompts. Core syntax
(variables, arithmetic, `if`/`while`/`for`, functions, the built-in types) is the baseline the
rest of the platform already depends on and is not re-listed here.

**Not yet in the safe subset** — SPIKE.md check 1's file-delivery rows confirmed `.2f` and `!r`,
and nothing else from the format-spec mini-language:

| Construct outside the safe subset | Why it is excluded | Replacement to suggest |
|---|---|---|
| f-string format spec other than `.Nf`, e.g. `f"{x:>8}"`, `f"{x:,}"`, `f"{x:%}"` | Only `.2f` was run (SPIKE.md); padding, alignment, `,` and `%` are unverified | `round(x, 2)`, or build the string with `+` |

This table grows only from a confirmed SPIKE.md divergence — never from a guess about what
Skulpt might not support.

### `FILE_UNSUPPORTED`

Distinct from every error class in `lib/errors/`. A `PyError` means the student's program is
wrong or crashed; `FILE_UNSUPPORTED` means the program is valid Python that Hilka's engine
cannot run. The message must say exactly that — a platform limitation, not a mistake — name the
unsupported construct, offer the replacement from the table above when one exists, and tell the
student to report it to the teacher. It is never phrased as a wrong answer, and it is raised
before the program runs at all: the AST is parsed on upload, ahead of any execution.

### Worked example — grade 8 `fix`, file delivery

```json
{
  "type": "fix",
  "payload": { "type": "fix", "surface": "console",
               "prompt": "Програма мала обчислити ІМТ, але видає помилку. Виправ її в IDLE.",
               "broken": "w = input()\nh = input()\nprint(w / h ** 2)",
               "delivery": "file",
               "file": { "filename": "bmi_fix.py", "headerComment": true, "maxBytes": 65536 } },
  "cases": [
    { "label": "звичайний випадок", "stdin": ["70", "1.75"],
      "checks": [{ "kind": "number_close", "value": 22.86, "tol": 0.05, "which": "last" }] }
  ],
  "checks": [],
  "reference": { "code": "w = float(input())\nh = float(input())\nprint(w / h ** 2)" }
}
```

The student downloads `bmi_fix.py` (header comment plus the prompt plus `broken`), fixes the
missing `float()` conversions in IDLE, saves, and uploads the result. The upload runs through
validation above, then the same `RunCase`/`Check` evaluation as an inline `fix` task — the
`broken` string above must still fail at publish, exactly as for inline delivery.

## Run cases

```ts
interface RunCase {
  stdin: string[];             // consumed in order by input()
  checks: Check[];             // in addition to the task-level checks
  label?: string;              // shown to the student after submission
  hidden?: boolean;            // not shown before submission (graded mode)
}
```

For grade 8 projects, two to four cases is the right number: a typical one, a boundary one, and
one that catches the obvious wrong branch. Label them in Ukrainian — the case list doubles as
the «таблиця тестування» the grade 9 programme asks for.

## Checks

```ts
type Check = { message?: string } & (
  // --- no execution -------------------------------------------------------
  | { kind: 'choice_equals';   indices: number[] }
  | { kind: 'order_equals';    lines: number[]; checkIndent?: boolean; indents?: number[] }
  | { kind: 'text_equals';     value: string; normalize?: 'trim' | 'loose' }

  // --- console output -----------------------------------------------------
  | { kind: 'stdout_equals';   value: string; trim?: boolean }   // no-input tasks only
  | { kind: 'stdout_contains'; value: string; ignoreCase?: boolean }
  | { kind: 'last_line_equals';value: string; normalize?: 'trim' | 'loose' }
  | { kind: 'number_close';    value: number; tol: number; which?: 'last' | 'first' | number }
  | { kind: 'numbers_equal';   values: number[]; tol: number }

  // --- program state ------------------------------------------------------
  | { kind: 'var_equals';      name: string; value: unknown }
  | { kind: 'expr';            python: string }        // must evaluate truthy after the run

  // --- turtle -------------------------------------------------------------
  | { kind: 'shape_equals';    tolerance?: number;
                               normalize?: ('translate' | 'rotate' | 'scale')[] }
  | { kind: 'shape_contains';  segments: Segment[]; tolerance?: number }
  | { kind: 'shape_props';     closed?: boolean; segmentCount?: number | [number, number];
                               totalLength?: [number, number];
                               bbox?: [number, number, number, number];
                               colors?: string[] }

  // --- source constraints -------------------------------------------------
  | { kind: 'uses';            any?: string[]; all?: string[] }   // AST node / call names
  | { kind: 'forbids';         names: string[] }

  // --- grid (optional, build later) --------------------------------------
  | { kind: 'grid_goal' }
);
```

### Implementation status

`lib/checker/` evaluates these today: `choice_equals`, `order_equals`,
`text_equals`, `stdout_equals`, `stdout_contains`, `last_line_equals`,
`number_close`, `numbers_equal`, `shape_equals`, `shape_contains`, `shape_props`,
`uses`, `forbids`, `var_equals`, `expr`.

`order_equals` compares `submission.orderedLines[i].index` against `check.lines[i]` always, and
additionally `.indent` against `check.indents[i]` when `checkIndent` is true — `indents` is the
field TASK_SCHEMA previously lacked, now what `parsons.indentMode: 'chosen'` is graded with. A
`checkIndent: true` with no `indents` (or a mismatched length) never passes — an authoring
mistake, not a lenient default.

`uses`/`forbids` run against `Submission.code` through `lib/checker/ast.ts`, a
small Python tokenizer (not a full parser) that skips string and comment
contents and tracks dotted attribute chains, so `while` cannot be satisfied by
a variable named `whileCount` or by the word appearing inside a string, and
`turtle.forward` can be matched as a call name in addition to its parts.

`var_equals` and `expr` need the runner to expose program state, which
`lib/runner/` now does: `RunResult.vars` holds the module's global variables
after a run that finished without an error (restricted to plain data — no
functions, classes, or imported modules), and `RunResult.exprResults` holds
one boolean per string the caller passed as `RunOptions.exprs`, evaluated in
the same global scope right after the program's own code, each wrapped in its
own `try/except` so one bad expr cannot take down the ones after it or the
run itself. The checker only reads these two maps; it still never executes
anything itself. See "Python Runner" in AI_CONTEXT.md and the `name_$rw$`
gotcha before reading `RunResult.vars` from anywhere new.

Not yet, and **never reported as a pass** — `evaluateCheck` marks it
`unsupported` rather than letting a task through: `grid_goal` waits on the
grid being built at all.

### Rules that are not optional

**`stdout_equals` is banned on any task with `cases`.** Prompt wording varies legitimately
between correct solutions; exact matching fails students who are right. Use `number_close`,
`numbers_equal`, or `last_line_equals` instead. Enforce this in the authoring UI, not by
convention.

**`shape_equals` compares normalized segment sets, never command logs.** Normalization: round
coordinates to 1 px (`tolerance` default 1), order each segment's endpoints canonically, drop
zero-length segments, deduplicate, compare as sets. `right(90)` and `left(270)` must both pass.

**`normalize: ['rotate']`** allows a square drawn starting from a different heading.
**`['translate']`** allows a different starting position. Use them unless the task text
actually pins the position down.

**`uses` and `forbids` operate on a parsed AST, not on string search.** `forbids: ['while']`
must not fire on a variable named `whileCount`, and `uses: { all: ['for'] }` must not be
satisfied by the word `for` inside a string literal. Use them sparingly — a task that demands a
specific construct is teaching syntax, not problem solving, and only a few topics need that.

**`expr` is the escape hatch.** Every `expr` is Python that must run, which makes the task
slower and the checker harder to reason about. Prefer a fixed kind.

### Messages

`message` is shown verbatim when that check fails, before any generic fallback. Write it as
guidance, not as a verdict: «Периметр правильний, але фігура не замкнена» beats «Неправильно».
A check with no `message` falls back to a calm generic line for its kind.

## Reference solutions

```ts
interface Reference {
  code: string;                // the author's correct solution
  computedAt: string;
  artifacts: {
    perCase: { stdout: string; numbers: number[]; vars: Record<string, unknown> }[];
    drawing?: Segment[];
    error: null;
  };
}
```

Artifacts are derived by executing `reference.code`, never hand-written.

**Publish is rejected if the reference solution does not pass the task's own checks.** This one
rule removes most authoring mistakes before a class sees them. It also catches tasks broken by
a runner upgrade: re-running all references is a single job.

For `fix` tasks, `payload.broken` and `reference.code` are both required, and publish
additionally verifies that `broken` **fails** — a "broken" program that passes is a bug in the
task.

**`parsons` has no `reference` at all.** Nothing executes, so there is nothing to run and derive
artifacts from — `payload.lines` is already stored in the correct order, and that order *is* the
reference. `lib/task/parsons.ts`'s `parsonsCanonicalSubmission` builds the submission that order
implies, and the publish route (`app/api/tasks/[id]/publish/route.ts`) evaluates it against the
task's own checks entirely server-side, with no client run to post first. The same rule as
above still holds: publish is rejected if that canonical submission does not pass.

**`quiz` has no `reference` either, and no canonical submission to build one from.** The correct
answer isn't implied by anything in `payload` — it lives entirely in `checks`
(`choice_equals.indices`). So there is nothing to *run* against the checks; instead
`lib/task/quiz.ts`'s `validateQuizChecks` confirms the checks are internally consistent with the
payload — every index actually names an option, and a single-answer quiz (`multiple: false`)
names exactly one. That is what the publish gate checks, entirely server-side.

## Parameterization

```ts
interface ParamSpec {
  [name: string]: { int: [number, number] }
                | { choice: string[] }
                | { float: [number, number]; step: number };
}
```

Placeholders are written `{a}` in `payload` text, in `cases[].stdin`, and in `reference.code`.
Values are derived from `seed = hash(sessionId + studentName + taskId)` via a seeded PRNG in
`lib/seed/`, so the same student always sees the same variant and a teacher's report reproduces
it exactly.

There is no server-side Python (AI_CONTEXT.md, "Python Runner"), so "expected artifacts" are
never precomputed or cached — `GET /api/sessions/[code]/tasks/[taskId]` substitutes the
placeholders server-side (`lib/task/params.ts`'s `resolveTaskParams`) and hands the browser an
otherwise-ordinary task; `lib/task/use-task-runner.ts`'s existing warm-up run (which already
re-executes `reference.code` fresh on every page load, parameterized or not) does the rest with
no changes of its own.

This means only checks whose expected value comes from *running* the reference actually work
today — `shape_equals`/`shape_contains` (turtle) and anything with no fixed value at all
(`shape_props`, `uses`, `forbids`). A check with a hand-typed expected value —
`number_close`/`text_equals`/`stdout_equals`/`var_equals` — stays fixed across every variant, so
it is very likely wrong for at least one combination. `npm run verify:references` (which checks
*every* combination, not a sampled seed) catches this immediately as a normal reference-check
failure — it is a real authoring mistake, not a special case to detect separately. `expr` is the
one exception: `check.python` is plain text, so writing the placeholder directly into the
expression (e.g. `"total == {a} * 4"`) substitutes the same way `reference.code` does — that
path is untested today.

Keep parameter spaces small and every combination valid. A range that can produce a division by
zero or a negative square root will produce it, in a graded session, for exactly one student.
`lib/seed/params.ts`'s `enumerateParamCombinations` throws past 500 combinations rather than
silently taking a long time to verify or publish.

**Not built**: an authoring UI — a parameterized task is hand-authored JSON in
`content/seed-tasks/`, the same way `cases` started (docs/TASKS.md); `params` on `fix` or
`predict`; anything beyond `code`. `/practice` has no session or student identity, so a
parameterized task must only ever be assigned to a session, never opened there.

## Randomness and determinism

Grade 9 uses the `random` module. In `headless` mode the runner seeds it deterministically from
`randomSeed`, so a program using `random` still has a reproducible expected output. In
`interactive` mode randomness is real.

A task whose answer genuinely depends on randomness should be checked with `shape_props`,
`uses`, or a range check — not with an exact expected value.

## Worked examples

### Grade 8 — BMI (input-driven)

```json
{
  "type": "code",
  "payload": { "type": "code", "surface": "console",
               "prompt": "Прочитай вагу і зріст, обчисли ІМТ і виведи його.",
               "starter": "" },
  "cases": [
    { "label": "звичайний випадок", "stdin": ["70", "1.75"],
      "checks": [{ "kind": "number_close", "value": 22.86, "tol": 0.05, "which": "last" }] },
    { "label": "менша вага", "stdin": ["50", "1.60"], "hidden": true,
      "checks": [{ "kind": "number_close", "value": 19.53, "tol": 0.05, "which": "last" }] }
  ],
  "checks": [],
  "reference": { "code": "w = float(input())\nh = float(input())\nprint(w / h ** 2)" }
}
```

No check touches prompt text. A student who prints «Введіть вагу:» and one who prints nothing
both pass.

### Grade 7 — square (turtle)

```json
{
  "type": "code",
  "payload": { "type": "code", "surface": "turtle",
               "prompt": "Намалюй квадрат зі стороною 100.", "starter": "import turtle\n" },
  "checks": [
    { "kind": "shape_equals", "normalize": ["translate", "rotate"] },
    { "kind": "shape_props", "closed": true, "segmentCount": 4,
      "message": "Фігура має складатися з чотирьох сторін." }
  ],
  "reference": { "code": "import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)" }
}
```

A student who writes four `forward`/`left(270)` pairs passes. One who draws a rectangle fails on
`shape_equals` with a picture that visibly differs from the translucent target.

### Grade 7 — Parsons, loop

```json
{
  "type": "parsons",
  "payload": { "type": "parsons", "indentMode": "given",
               "prompt": "Склади програму, що малює трикутник.",
               "lines": [
                 { "text": "import turtle", "indent": 0 },
                 { "text": "for i in range(3):", "indent": 0 },
                 { "text": "turtle.forward(100)", "indent": 1 },
                 { "text": "turtle.right(120)", "indent": 1 }
               ],
               "distractors": ["turtle.right(90)"] },
  "checks": [{ "kind": "order_equals", "lines": [0, 1, 2, 3] }]
}
```

No execution, no syntax errors possible, instant feedback. This is the entry point for a
reluctant student and should be the first task of most topics.
