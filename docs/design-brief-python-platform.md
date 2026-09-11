# Design Brief — Python Learning Platform (school, ages 12–15)

## What this is

A web platform where school students write and run Python in the browser, guided
step by step through short tasks. Two contexts of use: everyday practice, and
graded classroom sessions run by a teacher.

All interface copy is in **Ukrainian**. Every typeface chosen must have complete
Cyrillic coverage including the Ukrainian-specific glyphs і, ї, є, ґ, and the
apostrophe. Verify this before proposing a family — most display faces fail here.

## Audience

Students aged 12–15 who did not choose to learn programming. They come from
Scratch. They have already tried one text-based tool and abandoned it. They are
not hostile — they are unconvinced, and they quit silently the first time the
screen makes them feel stupid.

This age band is not homogeneous. A 12-year-old tolerates cartoon styling; a
15-year-old reads it as condescension and disengages within thirty seconds. The
design must not pick a side.

## The organizing principle

**The workspace is a tool. The reward layer is a garden.**

The screen where a student writes code stays calm, adult, and quiet — closer to a
well-made editor than to a game. Nothing bounces, nothing celebrates, nothing
distracts. Progress, growth, and reward live in a separate warm layer that
appears *between* tasks: after a completed task, on the topic map, on the
student's own progress screen.

This split is what makes the same product work for both ends of the age range.
Do not blend the two. Do not decorate the workspace with the garden.

## Visual direction: cozy

Warm, low-contrast, unhurried. The metaphor is quiet growth — something small
that becomes something larger over a term. Think a bright room with plants in
it, not a fantasy world and not a corporate dashboard.

Explicitly avoid the current default "cozy" look: cream paper background with a
high-contrast serif display face and a terracotta accent. It is everywhere and it
will make this look generated. Find the warmth in green, sand, and honey instead
of clay, and keep the display face closer to a humanist sans than to a serif.

### Starting palette (adjust, but keep the temperature)

Light theme
- `bg` #F1F3EC — pale green-grey, not cream
- `surface` #FAFAF6
- `ink` #262C27
- `ink-muted` #636D64
- `accent` #3E6B63 — deep green-teal, all interactive elements
- `growth` #6E9A5F — progress, garden, completion
- `honey` #C9922F — XP, rewards, unlocks
- `attention` #A8763C — "not correct yet", never red

Dark theme
- `bg` #1A201D — green-tinted, not neutral charcoal
- `surface` #242B27
- `ink` #E3E7DE
- `accent` #6FA79C
- `growth` #86B575
- `honey` #DFAE4E
- `attention` #C79358

True red exists only for system failure (connection lost, session closed). A
student's wrong answer never turns the screen red.

### Type

Two families, clearly distinct:
- **Interface + display:** a humanist sans with full Ukrainian Cyrillic.
  e-Ukraine and Onest both qualify and both are free; Inter is the safe fallback.
  Use weight and size for hierarchy, not a second display face.
- **Code, output, and anything the student typed:** a monospace with Cyrillic —
  JetBrains Mono or Fira Code.

Monospace is reserved for code. It is not a styling device for labels or
metadata.

### Restraint

Spend the visual boldness in one place: the moment a task is completed. Keep
everything else quiet. No decorative gradients, no shadow on every card, no
hover animation on every surface.

## Hard constraints

- Design canvas **1366×768**. School monitors, often washed out, often viewed at
  an angle. Not a laptop retina screen.
- The workspace must also be legible **on a projector from the back row** — the
  teacher displays a task to the whole class.
- Light and dark themes, both delivered. An afternoon classroom with south-facing
  windows is a real condition, not an edge case.
- Weak hardware (4 GB RAM, integrated graphics). No heavy graphics, no video, no
  particle effects, no continuous animation.
- Never encode state in color alone. In a class of 25 there will be a student who
  cannot separate red from green. Shape and icon carry the meaning; color
  reinforces it.
- Sound is off by default and mutes in one click.

## Screens and components

### Student — workspace (the screen that occupies 30 minutes of a lesson)

Three zones: task statement and theory, the editor, the output. Decide and show:
what collapses when the task text is long, where the theory goes once the student
starts typing, and how the layout survives a task with a visual grid attached.

Components: task card, code editor with the failing line marked, **Run** button
in four states (idle, running, disabled, engine still loading), output panel,
hint (collapsed and expanded), exam timer.

### Student — task types

Each needs its own treatment inside the same frame:
- **quiz** — multiple choice
- **predict** — "what does this code print", read-only code plus an answer field
- **parsons** — shuffled code lines reordered by dragging. Draw the block at
  rest, hovered, being dragged, dropped correctly, dropped wrongly, and show how
  indentation is expressed. This is the most important type in the product — it
  is where a reluctant student gets their first win, and it must feel physical
  and satisfying.
- **fill** — finished code with gaps to complete
- **code** — write from scratch
- **fix** — broken code to repair

### Student — grid and character

An 8×8 grid with a small character that moves when the code runs. Cell,
character, goal, obstacle, trail of the path already taken. Keep it flat and
simple — this is CSS, not a rendering engine.

### The error state — the most important screen in the project

This is where the previous tool lost these students. Requirements:

- Not red. No shaking, no cross, no failure sound, no "Error" as a heading.
- Calm surface, quiet icon, and a message written as though someone is looking at
  the problem alongside the student.
- The message says what happened and what to do next, in plain Ukrainian, with
  the relevant line of the student's own code shown inline. Never a raw Python
  traceback.
- Failure never costs progress. There is always an obvious way to try again.

Draw three distinct variants: syntax error, code ran but produced the wrong
result, and code did not finish (infinite loop / timeout).

### The success state

The one place where generosity is allowed. A brief, warm, unmistakable moment,
plus what was earned. It should feel like something opened, not like a scoreboard
incremented.

### Loading

The Python engine takes a few seconds to load on a weak machine. Design that
wait. Without it the student sees a blank panel and presses F5.

### Meta layer — the garden

Topic progress, XP, the reward moment, and the growing thing itself at several
stages across a term. Warm, illustrative, gender-neutral, unhurried. This is the
only place in the product that is allowed to look like a game.

### Entry

Join-by-code screen: the teacher puts a six-character code on the projector and
the code field must be readable from the back of the room. Then the student picks
their name from the class list. No password, no email, no registration.

### Teacher

Do not skip these — they are half the product and they are where a teacher
spends their preparation time.
- Class table: who is working, who is stuck, who has finished.
- Student card: attempts, submitted code, hints used, time spent.
- Session builder: pick tasks, filter by grade tag and topic, set time limit and
  whether hints are available.
- Task editor: the full authoring form for all six task types, including the
  checker and the hint list. It is dense and unglamorous. Make it calm and
  scannable rather than pretty.

## Copy

Write real Ukrainian copy, not lorem ipsum — the tone of the messages is half the
design here.

Buttons say what happens: "Запустити", "Перевірити", "Спробувати ще". Sentence
case throughout, no all-caps labels. Errors do not apologize and are never vague.
Empty states invite an action rather than describing emptiness.

## Deliverables

- Figma file with auto-layout and real components, not hand-drawn screens. New
  tasks will be added weekly and the layouts must absorb them without redrawing.
- A token sheet as named variables: color, spacing scale, type scale, radii,
  border widths, shadow levels — in a form that maps directly onto CSS custom
  properties.
- Both themes.
- The six task types, the three error variants, and the loading state as explicit
  screens rather than as notes.

## What will make this fail

- A workspace that looks like it was made for nine-year-olds.
- An error state that looks like punishment.
- Reward visuals bolted onto the coding screen instead of separated from it.
- A design that only works at 1440 px on a clean display.
- Beautiful student screens and an unconsidered teacher dashboard.
