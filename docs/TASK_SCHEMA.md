# Task Schema — Data Contract

The single source of truth for task payloads, checks, run cases, and parameterization. The
authoring UI, the checker evaluator, and the task components all conform to this file. Any new
check kind is added here in the same commit as its evaluator.

## Task

```ts
interface Task {
  id: string;
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
      surface: 'console' | 'turtle' | 'grid' }

  | { type: 'fix';     prompt: string; broken: string;
      surface: 'console' | 'turtle' | 'grid' }
```

`code` and `fix` execute Python. `fill` executes Python after substitution. `quiz`, `predict`
(text/choice mode), and `parsons` do not execute anything and stay instant on weak hardware.

Notes:
- `parsons.indentMode: 'chosen'` is the harder variant and the only one that teaches Python
  indentation. Default to `'given'` for a topic's first Parsons task and `'chosen'` later.
- `predict.imageOptions` renders N turtle reference programs as pictures and asks which one the
  shown code produces. The author writes N short programs; the platform renders them. No
  hand-drawn assets anywhere.

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
  | { kind: 'order_equals';    lines: number[]; checkIndent?: boolean }
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
`number_close`, `numbers_equal`, `shape_equals`, `shape_contains`, `shape_props`.

Not yet, and **never reported as a pass** — `evaluateCheck` marks them
`unsupported` rather than letting a task through: `var_equals` and `expr` need
the runner to expose program state, `uses` and `forbids` need a parsed AST, and
`grid_goal` waits on the grid being built at all.

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

Expected artifacts for a parameterized task cannot be precomputed for every seed. Compute them
on demand by running the substituted reference, and cache by `(taskId, version, seed)`.

Keep parameter spaces small and every combination valid. A range that can produce a division by
zero or a negative square root will produce it, in a graded session, for exactly one student.

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
