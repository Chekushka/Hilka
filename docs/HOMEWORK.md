# Homework — design proposal

> **Status: proposal, nothing built.** Written for the project owner to decide on. Decisions
> already made are marked **Decided**; what is still open is collected at the end. Nothing here
> overrides AI_CONTEXT.md until the design is settled and that file is updated.

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
- **Decided: late work is accepted and marked.** After `due_at` the homework stays open; each
  attempt made after the deadline (or after the student's own extended deadline) carries
  `flags.late`, and the class table and student card show it. Power cuts and air-raid alerts are
  the reason content is not tied to the timetable (AI_CONTEXT.md, "Course Structure"), and the
  same reason applies to deadlines. Whether "late" also lowers the suggested grade is open (end of
  this file); by default it does not — it is a fact for the teacher.
- The homework closes when the teacher closes it, not by itself.
- The teacher can extend the deadline for the class or for one student, and close early.
- A closed homework releases its code back to the pool, which is also the moment the code
  uniqueness index (`sessions_open_code_idx`) starts doing its job — today nothing ever closes.

### 2. Identity that survives several days — without accounts

**Open — the one decision step 1 still waits on.**

The problem in one sentence: today the only thing standing between a student and their roster
name is the 6-character session code, which the whole class knows. In class that is fine,
because the teacher sees who sits where. At home, with first-try-only grading (decided below),
it means a classmate can open your name and burn your first try with a wrong answer — and
nothing records that it was not you.

Rule 8 forbids accounts, email and passwords. Three designs fit within it.

**A. Claim on first use + continue code.**
- *Student:* enters the session code, picks their name, works. That first device now owns the
  name (a cookie for this homework). The screen shows an 8-character **continue code**
  («Код продовження: KX7M-2PQR») with a copy button and «Запиши або сфотографуй його».
- *Another device:* picking the same name asks for the continue code. Typing it moves the work
  there — same tasks, same results.
- *Teacher:* nothing to prepare. The class table shows who has claimed their name and on how many
  devices. **Reset claim** frees a name; the student then claims it again.
- *Lost code:* the student asks the teacher, who resets the claim. Nothing is lost, the results
  stay.
- *Weak point:* whoever opens a name **first** gets it. A classmate could claim your name before
  you, and use your first tries. Mitigation: every attempt records which claim made it, so
  "reset claim" can also **void the attempts that claim made** — the real student gets their
  first tries back. The sabotage is undone, not just noticed. The real student notices
  immediately («Це ім'я вже зайняте») and tells the teacher.
- *Stored:* a hash of the token and of the continue code, a timestamp. Nothing about the person.

**B. Teacher-issued personal codes.**
- *Teacher:* before the first homework, presses «Роздрукувати коди» for the class and hands out
  slips — one per roster name, e.g. «Олена К. — 4827-KM». Once per class, reused for every
  homework.
- *Student:* enters the session code, picks their name, types their personal code. Works on any
  device, every time, no claiming.
- *Weak point:* the slip. Students aged 12–15 lose it, leave it in the classroom, or share it
  with a friend "to help". A lost slip means the teacher re-issues one; a shared slip means a
  friend can act as you, with no "already taken" warning to tell you.
- *Rule 8:* it is not a password the student chooses, there is no account and nothing personal,
  but it is a credential handed to a child. That is your call; AI_CONTEXT.md would record it as
  an exception if you take it.

**C. Both:** A by default; a per-class switch turns B on for classes where A was abused.

|  | A — claim + continue code | B — printed codes |
|---|---|---|
| Teacher preparation | none | print and hand out once per class |
| Student friction | none on the first device; a code only on the second | a code every time |
| Someone takes your name first | possible; you see it at once, the teacher resets and voids their attempts | not possible |
| A friend logs in as you with your permission | possible (you gave them the continue code) | possible (you gave them the slip) |
| Lost code | teacher resets, nothing lost | teacher re-issues, nothing lost |
| Works when the first device was the school computer | yes, with the continue code | yes |

**Recommendation: A.** No preparation, no codes for the honest majority, and the one real weak
point (claiming first) is both visible to the victim and fully reversible, which is what matters
under first-try-only grading. Add B later only if a class actually abuses A. Neither stops a
friend whom the student *invited* — no design without real accounts can, and the class check
(section 5) is the answer to that.

A new table, `session_claims`, rather than a column on the roster — the roster must stay a plain
array of names (AI_CONTEXT.md, "Non-obvious invariants").

### 3. State on the server

- On entry, the room loads the student's own attempts for the session (a new
  `GET /api/sessions/[code]/me`, authorized by the claim cookie): done marks, locked tasks and
  the task currently open are restored on any device, any day.
- **Which Check was first is decided by the server**, not the UI: `POST /api/attempts` knows
  whether this name already has an attempt on this task, so a reload or a second device cannot
  produce a second "first" try. In homework, a later attempt is recorded as a fix (section 4); in
  a graded class session, it is refused. The second half also fixes the in-class reload hole,
  so it is worth doing for every graded session.
- A time limit, if a homework has one ("once you start, 40 minutes"), is anchored on the server
  at the first task opened, not in `sessionStorage`.

### 4. Attempts and grading

**Decided:** homework produces a suggested grade (the teacher still decides, as with every
grade in Hilka — AI_CONTEXT.md, "Grading"); the **first Check counts**; after a failed first
Check the student **may fix the task for lower credit**; and the teacher can add **a task for
improving the grade**. The defaults below are proposed and open to change; they live in
`lib/grading/config.ts` as data like the rest of the grading numbers.

**Per task, in order:**

| What happened | Credit (share of the task's points) |
|---|---|
| Passed on the first Check | 100% (75% if a hint was opened — the existing rule) |
| First Check failed, passed on a later Check (a fix) | **60%** (hint rule applied on top) |
| Never passed | partial credit for input cases, as today, from the *first* Check |

- A fix is allowed as many times as the student needs — the fix is already worth less, and the
  point of fixing is learning. The student card shows how many Checks it took.
- In the room: after a failed first Check the task does not lock (as class graded mode does); it
  says «Можна виправити — зарахується частково» and stays open.
- The **10–12 band** (needs a fully solved difficulty 4–5 task) is opened only by a first-Check
  pass or by the grade-improvement task, not by a fix.

**The task for improving the grade («Завдання для покращення оцінки»):**
- In the builder, the teacher marks one or more of the homework's tasks as improvement tasks.
- It appears to a student once they have lost points somewhere (a failed first Check), not
  before — the main tasks come first.
- Its points can only **recover lost points**: the share of points is capped at 100% of the main
  tasks. First Check counts on it too, with no fix credit — it is already the second chance.
- A good source: the lesson's additional tasks (AI_CONTEXT.md, "Course Structure"), which are
  harder by design. The builder could offer them as suggestions.

**Worked example**, on the current bands (`lib/grading/config.ts`). Main tasks of difficulty 2,
3 and 4, worth 1 + 2 + 3 = 6 points. Task 1: first Check ✓ → 1. Task 2: first Check ✗, fixed →
2 × 0.6 = 1.2. Task 3: first Check ✓ after a hint → 3 × 0.75 = 2.25, and as a first-Check pass on
a difficulty 4 task it opens the 10–12 band. Total 4.45 / 6 = 74% → **9**. The student then
solves the improvement task (difficulty 3, 2 points) on its first Check: it may recover at most
the 1.55 points lost, so 6 / 6 = 100% → **12**. Had task 3 been the one that was only fixed, the
band would stay closed and the grade would stop at 9 — unless the improvement task is itself
difficulty 4–5.

### 4a. How the class check affects the grade

**Decided: it influences the grade. How — open.** Two ways it can, recommended first:

- **Confirmation (recommended).** The class check repeats a homework task with a new variant.
  Passing it confirms that task's homework credit as is. Failing it lowers that task to fix
  credit (60%) — "you solved it at home, but not on your own yet". A student who missed the
  class check (absent, air-raid alert) keeps their homework credit unchanged; nobody loses points
  for not being there. This targets exactly what the check is for: homework someone else did.
- **Weighted.** Final = 70% homework + 30% class check, both through the same bands. Simpler to
  explain to students, but it lowers the grade of a student who did honest homework and had a
  bad five minutes in class, and it needs a rule for absence.

The suggested grade shows its parts either way («домашнє 9 · перевірка в класі ✓ 2 з 2»), so the
teacher sees why.

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
  **Decided: built, and it influences the grade.** How exactly is in section 4a above.

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
| `sessions.due_at`, `pool_size`, improvement task ids | Sections 1, 4, 5 |
| `session_claims` (id, session_id, student_name, token_hash, resume_code_hash, created_at, reset_at) | Section 2 — no personal data |
| `attempts.claim_id` | Section 2 — so resetting a claim can void the attempts it made |
| `sessions.checks_session_id` (a class check points at its homework) | Section 4a |
| `attempts.flags` gains `late`, `pasted`, `edits`, `msToPass`, `normalizedHash`, `beyondTopic` | jsonb, no migration for the flags themselves |
| per-student deadline extensions (session_id, student_name, due_at) | Section 1 |

## Suggested order

1. **Homework that survives days** — `kind`, `due_at`, late marking, closing, identity
   (section 2), server-restored state, server-enforced first Check (which also fixes graded class
   sessions), fix credit and the improvement task in the suggested grade, deadline in the room and
   on the dashboard. Useful on its own.
2. **Class check** — generated from the homework, feeding the grade (section 4a). Moved up: it
   is now part of the grade, and the strongest anti-cheating measure.
3. **Facts for the teacher** — teacher-side re-verification, normalized similar-code groups,
   behavioural counts, constructs-not-taught-yet.
4. **Individual work** — shuffle, per-student task pools, variants for `fix`/`fill`/`predict`.

## Decided

- Late work is accepted and marked (section 1).
- First Check counts; a later fix earns reduced credit; the teacher can add a task for improving
  the grade (section 4).
- Homework produces a suggested grade (section 4).
- The class check is built and influences the grade (sections 5, 4a).

## Still open

1. **Identity**: A (claim + continue code, recommended), B (printed personal codes), or C (both)?
   Section 2. Step 1 waits on this.
2. **Fix credit**: 60% of the task's points, unlimited fix Checks — or a different share, or only
   one fix?
3. **Improvement task**: shown only after a lost point, recovering lost points only, first Check
   counts — as proposed?
4. **Class check**: confirmation (recommended) or weighted? Section 4a.
5. **Late**: a fact only (default), or should late work also earn less?
6. **Behavioural facts**: acceptable to record paste size, edit count and time-to-pass for
   homework? (Counts only, never content or keystrokes.)
