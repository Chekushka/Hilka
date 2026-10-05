# Homework — design

> **Status: steps 1–4 built** (see "Order of work" at the end): homework with a deadline and late
> credit, device marks, server-side state and limits, fixes and the improvement task, the
> suggested grade, the class check that confirms it, the facts for the teacher (re-check, similar
> code, paste/edit counts, constructs not taught yet), and individual work (per-student pools,
> shuffle, variants for `fix` and `fill`). `predict` variants are not built (section 5b). Decisions were made with the
> project owner; each is marked **Decided**. AI_CONTEXT.md carries the architectural summary.

## What is asked

A mode of the existing teacher session for **remote work from home**: students still join with
the teacher's 6-character code, but the work stays open for a few days, has a deadline, and is
harder to cheat on than an in-class session, where the teacher in the room is most of the
protection.

## Why a classroom session is not enough at home

A session was designed for 45 minutes with the teacher watching. Read against a three-day window
at home, five things in the code stopped holding (as found before step 1; the first, second,
fourth and fifth are now fixed for every session, sections 1–3):

| What the code did | Why it is fine in class | What happens at home |
|---|---|---|
| Nothing ever sets `sessions.closes_at`; a session stays open until someone edits the database | The teacher ends the lesson | No deadline at all |
| Graded mode's "first Check is final" is React state in `SessionRoom` | Nobody reloads during a test with the teacher watching | A reload, or a second tab, gives unlimited retries |
| The time limit is anchored in `sessionStorage` | Same | A new tab restarts the clock |
| A student picks **any** roster name, with no secret | The teacher sees who sits where | Anyone with the code can work as anyone else, or fail someone's graded tasks on purpose |
| Progress ("done" marks) lives in this visit's memory | One sitting | Day two starts from an empty list |

So the first half of this design is not anti-cheating at all: it is making a session survive
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

- `sessions.due_at` (timestamptz). The builder offers «Завтра, 18:00», «Через 3 дні», «Через
  тиждень» and a date/time picker on the teacher's clock; the room and the dashboard show it in
  Kyiv time with how far off it is («через 2 дні») — words, not a ticking clock
  (`lib/homework/deadline.ts`).
- **Decided: late work is accepted, marked, and earns less** — up to two days late 70% of the
  credit, later 50% (`lateSteps`, `lateCreditBeyond` in `lib/grading/config.ts`;
  `lib/homework/rules.ts`'s `lateCredit`). Lateness is computed when grades are read, from each
  attempt's time against the current deadline, so moving the deadline re-judges past work. The
  rule is stated to students under the deadline, and once it has passed the room says so in an
  attention notice with the current percentage. Power cuts and air-raid alerts are why it is not
  refused outright.
- The teacher can move the deadline and close the session from the session page. Closing frees
  the code; before this, nothing closed a session at all, lesson or not.
- **Not built:** per-student deadline extensions, and `opens_at` (a homework that opens later).

### 2. Identity that survives several days — without accounts

**Decided: option D — free entry, every device marked.** The problem: a roster name has no
secret behind it, so at home anyone with the code can work under anyone's name, and with
first-Check grading that can cost someone their first tries.

- **Entry is unchanged**: the session code, then the student's name picked from the roster.
- Every browser gets a random id in a long-lived cookie (`hilka_device`,
  `lib/session/device-cookie.ts`) — not a fingerprint, nothing about the person — and every
  attempt records it (`attempts.device_id`).
- **The student is told up front**, on the name screen of a homework, that every device is marked
  and the teacher sees it. If their name was already used from another browser, the task list
  says so calmly — «Під цим ім'ям уже працювали з іншого пристрою. Якщо це був не ти — скажи
  вчителю» — information, never a block.
- **The teacher** sees a «Пристрої» column on the class table (more than one is highlighted) and,
  on the student card, each device with its number of Checks and first/last use, and a button that
  **cancels everything one device did** under that name (`attempts.voided_at`). Cancelled
  attempts stay visible on the card, marked «скасовано», and stop counting everywhere — grades,
  tallies, exports — and the tries they used are free again.

Considered and set aside: **A**, the first device claims the name and a continue code moves it to
another device — it stops an intruder before the fact, but makes honest students carry a code and
leaves a student who lost it stuck until the teacher answers; and **B**, teacher-printed personal
codes — a credential handed to a child, every time. D can be tightened to A later for a class that
abuses it.

### 3. State on the server

- On entry the room reads the student's own attempts back (`GET /api/sessions/[code]/me`), so done
  marks, locks and fixes left survive a reload, another tab, another device and another day.
  Every session does this, not only homework.
- **`POST /api/attempts` applies the same rules as the room** (`lib/homework/rules.ts`'s
  `canSubmit`) inside a transaction holding an advisory lock per (session, name, task), so a
  double click or two tabs cannot both be "the first". A Check the rules do not allow gets 409 and
  is not recorded. This also closed the in-class hole: a graded lesson's first-Check lock used to
  live only in the browser, and a reload handed back a fresh task.
- Homework has no time limit.

### 4. Attempts and grading

**Decided:** homework produces a suggested grade (the teacher still decides — AI_CONTEXT.md,
"Grading"); the **first Check counts in full**; after a failed first Check the student has **two
fixes**, and a pass on a fix earns **70%**; the teacher can add **tasks for improving the grade**,
shown only after a point is lost. The numbers are data in `lib/grading/config.ts` (`maxFixes`,
`fixCredit`); the rules are `lib/homework/rules.ts`, the grade `lib/homework/grade.ts`.

**Per task:**

| What happened | Credit (share of the task's points) |
|---|---|
| Passed on the first Check | 100% |
| First Check failed, passed on the second or third (a fix) | 70% |
| Never passed | the best partial credit for input cases among the counted Checks, the same factors applied |

On top of that, per Check: 75% if a hint was opened (the existing rule) and the late credit of
the moment it was made. The task earns the best of its counted Checks. A fourth Check is refused
by the server and ignored by grading.

- In the room, before the first Check: «Зараховується перша перевірка. Якщо помилишся, зможеш
  виправити ще 2 рази — виправлене зараховується на 70%». After a failed one the task stays open
  with the fixes left; with none left it locks. A task already counted reopens on a «Зараховано»
  screen, not a fresh editor. The task list says each task's state in words.
- The **10–12 band** (needs a fully solved difficulty 4–5 task) is opened by a first-Check pass
  on a main task or by an improvement task, never by a fix.

**Tasks for improving the grade («Завдання для покращення оцінки»):**
- In the builder, any chosen task can be marked «покращення»; it is stored apart from the main
  tasks (`sessions.improvement_task_ids`).
- It appears once the student has lost points — a main task whose first Check did not pass — and
  stays, even after that task is fixed. The server refuses it before then.
- One Check, no fixes. Its points only **recover lost points**: the share never exceeds 100% of
  the main tasks.

**Worked example** (`lib/homework/grade.test.ts` runs it). Main tasks of difficulty 2, 3 and 4,
worth 1 + 2 + 3 = 6 points. Task 1: first Check ✓ → 1. Task 2: first Check ✗, fixed → 2 × 0.7 =
1.4. Task 3: first Check ✓ after a hint → 3 × 0.75 = 2.25, and as a first-Check pass on a
difficulty 4 task it opens the 10–12 band. Total 4.65 / 6 = 77.5% → **10**. The student then
solves the improvement task (difficulty 3, 2 points) on its first Check: it recovers at most the
1.35 points lost, so 6 / 6 = 100% → **12**.

### 4a. The class check and the grade

**Decided: confirmation.** The class check repeats a homework task in class. Passing it confirms
that task's homework credit as is. Failing it lowers that task to fix credit (70%) — "solved at
home, but not on your own yet" — and a hard task that fails its check no longer opens the 10–12
band. A student who missed the class check (absent, air-raid alert), or was not checked on a
task, keeps their homework credit unchanged. A check never raises anything.

**Built:**
- On the homework's page, «Перевірка в класі»: choose which main tasks (all by default), a time
  limit (10 min by default) and hints (off by default — the point is what the student can do
  alone), then «Створити перевірку» shows a code for the projector. Several checks of one
  homework may exist; for each task the student's earliest Check across them counts.
- The check is an ordinary graded session of the same class (`sessions.kind = 'check'`,
  `checks_session_id` → the homework): one Check per task, enforced by the same rules. Students
  are told what it does: «Розв'яжеш — бал за домашнє залишиться. Не вийде — це завдання в
  домашньому зарахується на 70%».
- **Same task, new variant where one exists.** A parameterized task's seed includes the session,
  so the check gives each student a different variant than at home. Other tasks are repeated as
  they are — still a fair test of whether the student can do it alone; per-task variants for more
  task types are step 4.
- The check has no grade of its own: its page says so and links to the homework. The homework's
  grade reads every check's attempts (`listCheckAttempts`; `lib/homework/grade.ts`) and shows
  «перевірка: ✓ 1 з 2»; the student card marks each task's check result.

### 5. Anti-cheating, by threat

Most valuable first. Each one produces a **fact on the student card or the class table**, never
a verdict.

**Against copying from a classmate (threat 1):**

- **Individual variants — already built, extend them.** `tasks.params` gives every student a
  different variant from `hash(session + student + task)` (the student's seed key,
  `lib/classes/roster.ts`); a copied answer prints the wrong numbers
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
  **Decided and built (step 2), as a confirmation of the homework credit** — section 4a above.

**Against impersonation and sabotage (threat 4):** device marks, section 2 — visible to the
student and the teacher, and undone by cancelling the other device's attempts.

**Against devtools tampering (threat 5):** the planned server-side CPython is not needed to close
most of it. Every code attempt already stores the student's source. A **"перевірити ще раз"**
action on the dashboard re-runs the stored code of every passed attempt **in the teacher's
browser** (the same runner and checker, with the student's own seed, exactly as the publish gate
already does for references) and flags any attempt whose stored code does not pass. Forging a
pass then requires forging code that passes — which is solving the task.

### 5a. The facts, as built (step 3)

Each is an observation for the teacher; none changes a grade, none is shown to a student.

- **Re-check** («Перевірити збережені відповіді», on every session page with a passed attempt;
  `components/dashboard/RecheckPanel.tsx`). `GET /api/dashboard/sessions/[id]/recheck` returns
  every passed attempt with what was submitted and the task as that student saw it (their own
  variant of a parameterized task). The teacher's browser runs each through
  `lib/task/recheck.ts` — programs through `lib/task/check-code.ts`, the very routine the room's
  Check now uses, so the two cannot disagree; quiz, predict and parsons answers through the
  evaluator directly — and lists any stored answer that does not pass. An attempt on an older
  version of a task is counted as not re-checked rather than judged by checks it never faced.
  Nothing is stored: the result lives on the page.
- **Paste and edit counts** (homework only, as decided). The code editor reports each change and
  each paste or drop (`CodeEditor`'s `onActivity`); `lib/task/activity.ts` keeps three counts —
  edits, largest paste in characters and in lines — never text, never keystrokes or timing. `code`
  and `fix` tasks send them with each attempt; `POST /api/attempts` keeps them in
  `attempts.flags.activity` only when the session is homework. A paste of 5+ lines with at most 3
  edits is a fact (`PASTE_RULE`). Fill gaps are not counted.
- **Similar code** (`lib/homework/similar.ts`). Each student's latest passing program per task,
  with comments, spacing and variable names normalized away; keywords, built-ins, modules,
  attribute names, numbers and strings kept, and indentation kept. Programs under 25 tokens are
  never compared — short answers match by honest coincidence — and `fill` programs never are,
  since they share their template by design.
- **Constructs not taught yet** (`lib/homework/constructs.ts`). "Taught" is read from the content,
  not kept by hand: every construct used by a published task in the homework's grades whose topic
  comes no later than the latest topic the homework covers — in its reference, starter, broken
  program, template, shown code or Parsons lines. A student's latest program per task is compared
  with that set, and what is left is named as code: `def`, `sum()`, `[… for …]`, `f"{x:…}"`.
- **Where it shows** (homework): a «Факти» column on the class table (a word per kind: «вставка»,
  «схожий код», «не з уроків»), a «Однаковий за структурою код» list on the session page, a
  «Факти» box on the student card in plain sentences, and each attempt's counts beside it.
  `lib/homework/facts.ts` gathers them; `lib/db/homework-facts.ts` reads what they need.

### 5b. Individual work, as built (step 4)

For any session, not only homework:

- **A pool per student.** «Скільки завдань дістається кожному учню» in the builder: each student
  gets K of the N tasks (`sessions.pool_size`, `drizzle/0007_add_task_pool.sql`), drawn by
  `lib/seed/assignment.ts` from a seed of the session and the student's seed key — the same student
  always gets the same tasks, on any device. The room shows only those; `POST /api/attempts`
  refuses another task (403) and `GET /api/sessions/[code]/tasks/[taskId]` will not hand it out
  (404). The class table counts each student against their own tasks and marks the rest «не
  призначено»; the suggested grade and the student card read only the student's own tasks
  (`lib/session/assigned.ts`). Improvement tasks are not pooled.
- **Shuffle.** `sessions.shuffle` was stored and never read; now each student meets their tasks
  in their own seeded order. The pool decides which tasks, shuffle only the order.
- **Variants for `fix` and `fill`**, beside `code` (`lib/task/params.ts`): placeholders in the
  prompt, the broken program or the template, the cases' input and the reference. The builder
  marks such tasks «свій варіант кожному» and counts them («Індивідуальні варіанти: 2 з 5»). A
  console variant is checked with the new `matches_reference` check (docs/TASK_SCHEMA.md): the
  expected output is the reference's own output on the same input, run beside the student's —
  so it is right for every variant, which a typed value cannot be. `npm run verify:references`
  runs every combination, and for a `fix` requires the broken program to fail in every variant.
  Content: `g8-fix-discount-variant` (lesson 46, additional) and `g7-fill-polygon-variant`
  (lesson 38, additional), session-only like every parameterized task.
- **Not built:** `predict` variants. A `predict` answer is the shown program's output; with
  variants it would have to be computed for every combination when the task is published (in the
  teacher's browser, ≤ 500 combinations) and stored, then picked per student — a bigger change
  to publishing than the rest of this step, so it waits for a decision on whether it is worth it.

### 6. The student's side at home

- No teacher to ask, so hints default to on, and the lesson's explanation is one click away (it
  already is, under «Як це працює»).
- The deadline is always visible in the room: «Здати до: пт, 9 жовтня о 18:00 (через 2 дні)»,
  with the late rule under it — words, not a ticking clock.
- Each task in the list says where it stands: «Зараховано», «Виправлено · 70%», «Можна
  виправити: ще 2», «Не зараховано».
- **Not built:** the entry page remembering this device's homework codes («Домашнє завдання: 3 з 5,
  до п'ятниці»), and a plain "everything handed in" line once all tasks are counted.

### 7. The teacher's side

- Session builder: a third mode beside «Практика» and «З оцінюванням» — «Домашнє завдання» — with
  the deadline and the «покращення» mark on chosen tasks; the rules are stated under the
  deadline. The time limit does not apply.
- Session page: the deadline, «Змінити термін», «Закрити заняття», a «Пристрої» column, and the
  suggested grade with what shaped it («виправлено: 1 · після терміну: 2 · повернуто: 1.4»).
  «Needs help» is off for homework, as for a graded lesson; a task counts as done once passed or
  out of fixes.
- Student card: late, device and cancelled marks on each attempt, the improvement tasks, and the
  devices with their cancel button.
- **Not built:** a separate homework list on the dashboard (homework is labelled in the session
  list), re-verification (step 3).

## Data model changes

Built (`drizzle/0005_add_homework.sql`):

| Change | Why |
|---|---|
| `sessions.kind` `'lesson' \| 'homework'`, default `'lesson'` | Keeps `mode` meaning what it means (`practice`/`graded`); homework is stored as `graded` |
| `sessions.due_at` | Section 1 |
| `sessions.improvement_task_ids` | Section 4 |
| `attempts.device_id` | Section 2 |
| `attempts.voided_at` | Section 2 — the one field of an attempt that ever changes |
| `sessions.kind = 'check'`, `sessions.checks_session_id` (`drizzle/0006_add_class_check.sql`) | Section 4a — a class check points at its homework |

Later: per-student deadlines, `attempts.flags` gaining `pasted`, `edits`, `msToPass`, `normalizedHash`, `beyondTopic`
(step 3; jsonb, no migration).

## Order of work

1. ✅ **Homework that survives days** — `kind`, `due_at`, late credit, closing, device marks,
   server-restored state, server-enforced limits (which also fixed graded lessons), fixes and
   improvement tasks in the suggested grade, deadline in the room and on the dashboard.
   `tests/e2e/homework.spec.ts`; unit tests in `lib/homework/`.
2. ✅ **Class check** — created from the homework's page, confirming or lowering its credit
   (section 4a). `tests/e2e/homework.spec.ts`; unit tests in `lib/homework/grade.test.ts`.
3. ✅ **Facts for the teacher** — section 5a. `tests/e2e/homework.spec.ts`; unit tests in
   `lib/homework/` and `lib/task/`.
4. ✅ **Individual work** — section 5b. `predict` variants are not built (section 5b says why).
   `tests/e2e/homework.spec.ts`; unit tests in `lib/seed/`, `lib/task/`, `lib/checker/`,
   `lib/dashboard/`, `lib/homework/`.

## Decided

- Identity: option D — free entry from the roster, every device marked, students told; the
  teacher can cancel one device's attempts (section 2).
- Late work is accepted: up to two days late 70%, later 50%, and students are told (section 1).
- First Check counts in full; two fixes at 70% (section 4).
- Improvement tasks appear only after a lost point and recover lost points only (section 4).
- Homework produces a suggested grade (section 4).
- The class check is built and confirms the homework credit; failing it lowers a task to 70%
  (section 4a).
- Behavioural counts may be recorded for homework (section 5).
