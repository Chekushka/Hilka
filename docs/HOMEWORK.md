# Homework — design proposal

> **Status: proposal, nothing built.** Written for the project owner to decide on. The open
> decisions are collected at the end; nothing here overrides AI_CONTEXT.md until they are made
> and that file is updated.

## What is asked

A mode of the existing teacher session for **remote work from home**: students still join with
the teacher's 6-character code, but the work stays open for a few days, has a deadline, and is
harder to cheat on than an in-class session, where the teacher in the room is most of the
protection.

## Why a classroom session is not enough at home

A session today was designed for 45 minutes with the teacher watching. Read against a
three-day window at home, five things in the current code stop holding:

| What the code does today | Why it is fine in class | What happens at home |
|---|---|---|
| Nothing ever sets `sessions.closes_at`; a session stays open until someone edits the database | The teacher ends the lesson | No deadline at all |
| Graded mode's "first Check is final" is React state in `SessionRoom` | Nobody reloads during a test with the teacher watching | A reload, or a second tab, gives unlimited retries |
| The time limit is anchored in `sessionStorage` | Same | A new tab restarts the clock |
| A student picks **any** roster name, with no secret | The teacher sees who sits where | Anyone with the code can work as anyone else, or fail someone's graded tasks on purpose |
| Progress ("done" marks) lives in this visit's memory | One sitting | Day two starts from an empty list |

So the first half of this proposal is not anti-cheating at all: it is making a session survive
several days, several devices and an unattended browser. The anti-cheating measures come after,
and they only mean something once those holes are closed.

## The threat model, realistically

Ordered by how often it will actually happen with 12–15-year-olds:

1. **Copying from a classmate** — a screenshot or the code itself in the class chat.
   The most common case by far.
2. **An AI chatbot** writes the solution. Increasingly common; cannot be detected reliably.
3. **Someone else at home solves it** — a sibling, a parent.
4. **Impersonation or sabotage** — logging in under another student's name, out of curiosity or
   malice. Rare, but in graded mode it destroys a grade, and it is trivial today.
5. **Devtools tampering** — posting `passed: true` without solving. Rare at this age, already
   documented as "not mitigated" in AI_CONTEXT.md.

The guiding rule stays the one AI_CONTEXT.md already states: **the system never accuses
anyone**. It surfaces facts for the teacher. A false accusation of a 13-year-old is a worse
outcome than an undetected copy, and "the AI detector said so" is not something to build.

## Recommended shape

**Homework is a session with `kind: 'homework'`, not a new subsystem.** It reuses the session
builder, the code, the roster, attempts, the class table, the student card, grading and the CSV
export as they are. What it adds is a deadline, identity that survives days, and server-side
state.

### 1. Deadline and lifetime

- `sessions.due_at` (timestamptz). The builder offers presets — "до завтра 20:00", "за 3 дні",
  "до наступного уроку" — and a date/time picker; times are Kyiv time
  (`lib/dashboard/time.ts` already formats in it).
- `opens_at` (already in the schema, unused) lets a teacher prepare homework on Friday that opens
  on Monday.
- After `due_at`: **choose per homework** between *closed* (the code lands on the calm not-found
  screen, as today) and *late allowed* (work is still accepted, each attempt is marked late, the
  teacher sees it, the suggested grade can ignore late attempts). Recommendation: late allowed
  by default — power cuts and air-raid alerts are the reason content is not tied to the
  timetable (AI_CONTEXT.md, "Course Structure"), and the same reason applies to deadlines.
- The teacher can extend the deadline for the class or for one student, and close early.
- A closed homework releases its code back to the pool, which is also the moment the code
  uniqueness index (`sessions_open_code_idx`) starts doing its job — today nothing ever closes.

### 2. Identity that survives several days — without accounts

Rule 8 forbids accounts, email and passwords. Two designs fit within it; they can be combined.

**A. Claim on first use + resume code (recommended).** The first device to pick a name *claims*
it: the server stores a hashed random token and sets a cookie for that session. Picking the same
name from another device is refused with "Це ім'я вже зайняте. Якщо це ти — введи код
продовження" — an 8-character code shown to the student at claim time (the same alphabet and UI
as progress codes, so nothing new to learn). The class table shows who has claimed, and the
teacher can **reset a claim** in one click when a student lost the code or someone took their
name. Zero friction for the honest case; sabotage becomes visible and reversible instead of
silent.

**B. Teacher-issued personal codes.** The teacher prints a card per student with a short random
code tied to the roster name (no other data). Stronger — nobody can claim first — but it is a
credential the student did not choose and will lose, and it costs the teacher a print-out.
Worth offering only as an option for graded homework.

Neither stores anything about the student beyond the roster name: a token hash and a timestamp
per (session, name). A new table, `session_claims`, rather than a column on the roster — the
roster must stay a plain array of names (AI_CONTEXT.md, "Non-obvious invariants").

### 3. State on the server

- On entry, the room loads the student's own attempts for the session (a new
  `GET /api/sessions/[code]/me`, authorized by the claim cookie): done marks, locked tasks and
  the task currently open are restored on any device, any day.
- **Graded homework's first-Check rule is enforced by `POST /api/attempts`**, not only the UI: a
  second graded attempt on the same task by the same name is refused. This also fixes the
  in-class reload hole, so it is worth doing for every graded session.
- A time limit, if a homework has one ("once you start, 40 minutes"), is anchored on the server
  at the first task opened, not in `sessionStorage`.

### 4. Attempt policy

Homework is mostly for learning, and the grading rule "first Check only" pushes a student to
get a verified answer from a classmate *before* pressing Check. Offer three policies:

| Policy | Retries | What counts | Fits |
|---|---|---|---|
| Навчальне (default) | unlimited | best attempt; number of Checks shown to the teacher | ordinary homework |
| Обмежене | N Checks per task (e.g. 3) | best attempt | homework that is graded |
| Контрольне | first Check | first attempt | a take-home test |

The grading config (`lib/grading/config.ts`) already works per attempt; "best attempt" is a
query, attempts stay append-only.

### 5. Anti-cheating, by threat

Most valuable first. Each one produces a **fact on the student card or the class table**, never
a verdict.

**Against copying from a classmate (threat 1):**

- **Individual variants — already built, extend them.** `tasks.params` gives every student a
  different variant from `hash(session + name + task)`; a copied answer prints the wrong numbers
  for the receiver. Today it covers `code` tasks only. For homework, extend to `fix`, `fill` and
  `predict` (TASKS.md lists them as not built), and show in the builder how many of the chosen
  tasks are parameterized ("3 з 5 завдань мають індивідуальні варіанти").
- **A task pool per student.** The teacher picks, say, 8 tasks and "each student gets 5": the
  selection is seeded per student like variants. Neighbours can still help each other learn,
  but they cannot hand over a complete homework.
- **Shuffle** — `sessions.shuffle` is stored and never read. Implement it.
- **Similar code across students.** The file-delivery hash flag (`lib/dashboard/shared-files.ts`)
  generalised to every code task, after normalising what copying changes cheaply: comments,
  blank lines, whitespace, variable names (the tokenizer in `lib/checker/ast.ts` already exists).
  Shown as "Однаковий за структурою код: Олена, Марко, Ігор", with the code side by side.

**Against AI chatbots and help at home (threats 2–3):**

- **Constructs not taught yet.** A chatbot writes `def`, list comprehensions, `sum()`, f-string
  format specs, `while True: … break` where the lesson taught a counter loop. The lesson's topic
  and grade are known, so a flag like "використано конструкції, яких ще не було: def, [x for …]"
  is cheap with the existing `uses` tokenizer and a per-topic allow-list. A fact, not proof:
  some students read ahead.
- **Behavioural facts** (already planned in AI_CONTEXT.md, `attempts.flags`, unbuilt): a large
  paste into an empty editor, few edits before a pass, time from opening the task to a pass.
  Counts only, no keystroke logging. Most useful in combination: "вставлено 14 рядків, 2
  редагування, 40 секунд".
- **A short in-class follow-up — the strongest measure, and the only one AI cannot defeat.**
  After the deadline, the dashboard offers "Перевірити розуміння": a 5-minute in-class session
  generated from the homework itself — the same tasks with a fresh variant, or "change your
  program so that…". The teacher can apply it to the whole class or to the students with facts
  against them. Homework that the student can redo in class is their own; homework they cannot
  redo tells the teacher what they need to know without any accusation from the software.
  Recommendation: build this, and present homework grades as "suggested, pending the class
  check" when it is turned on.

**Against impersonation and sabotage (threat 4):** the claim in section 2. Every claim, reset
and refused attempt to pick a claimed name is visible to the teacher.

**Against devtools tampering (threat 5):** the planned server-side CPython is not needed to close
most of it. Every code attempt already stores the student's source. A **"перевірити ще раз"**
action on the dashboard re-runs the stored code of every passed attempt **in the teacher's
browser** (the same runner and checker, with the student's own seed, exactly as the publish gate
already does for references) and flags any attempt whose stored code does not pass. Forging a
pass then requires forging code that passes — which is solving the task.

### 6. The student's side at home

- No teacher to ask, so hints default to on, and the lesson's explanation is one click away (it
  already is, under «Як це працює»).
- The deadline is always visible in the room: "Здати до п'ятниці, 18:00 · залишилось 2 дні", in
  words, not a ticking clock — a countdown is pressure the brief avoids.
- The entry page remembers the homework codes this device has joined (localStorage) and shows
  "Домашнє завдання: 3 з 5, до п'ятниці" with a link back, so nobody needs to find the code again.
- A finished homework says so plainly ("Усе здано. Учитель побачить твої відповіді."), with the
  done tasks still open for practice.

### 7. The teacher's side

- Session builder: a third mode beside «Практика» and «З оцінюванням» — «Домашнє завдання» —
  with the deadline, late policy, attempt policy, and the pool size.
- Dashboard: a "Домашні завдання" list with status (opens, open, due today, closed) and how many
  finished. The class table gets a late mark, claims (and a reset button), and the facts above
  next to each name. "Needs help" (`lib/dashboard/class-status.ts`) needs different thresholds
  over days than over minutes, or turning off for homework.
- Extend deadline / close now / re-verify.

## Data model changes

| Change | Why |
|---|---|
| `sessions.kind` `'lesson' \| 'homework'` | Keeps `mode` meaning what it means today (`practice`/`graded`) |
| `sessions.due_at`, `late_policy`, `attempt_policy`, `pool_size` | Section 1, 4, 5 |
| `session_claims` (session_id, student_name, token_hash, created_at, reset_at) | Section 2 — no personal data |
| `attempts.flags` gains `late`, `pasted`, `edits`, `msToPass`, `normalizedHash`, `beyondTopic` | jsonb, no migration for the flags themselves |
| per-student deadline extensions (session_id, student_name, due_at) | Section 1 |

## Suggested order

1. **Homework that survives days** — `kind`, `due_at`, late policy, closing, claim + resume code,
   server-restored state, server-enforced first-Check (which also fixes graded class sessions),
   deadline in the room and on the dashboard. Useful on its own.
2. **Facts for the teacher** — teacher-side re-verification, normalized similar-code groups,
   behavioural counts, constructs-not-taught-yet.
3. **Individual work** — shuffle, per-student task pools, variants for `fix`/`fill`/`predict`.
4. **Class check** — the in-class follow-up generated from the homework.

## Decisions needed

1. **Identity**: claim-on-first-use with a resume code (recommended), teacher-printed personal
   codes, or both? Does a teacher-issued code count as a "password" under CLAUDE.md rule 8?
2. **Late work**: accepted and marked (recommended) or refused after the deadline?
3. **Attempt policy**: are the three policies right, and which is the default?
4. **Grades from homework**: should homework produce a suggested grade at all, or only completion?
5. **Class check**: worth building, and should it gate the homework grade?
6. **Behavioural facts**: acceptable to record paste size, edit count and time-to-pass for
   homework? (Counts only, never content or keystrokes.)
7. **Scope of step 1**: start there, or is one of the anti-cheating measures more urgent for you?
