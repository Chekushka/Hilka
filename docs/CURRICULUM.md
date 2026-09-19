# Curriculum Reference — Programming Sections, Grades 7–9

Source: three calendar plans supplied by the teacher, all following the model programme
«Інформатика. 7–9 клас» (Пасічник О. В., Козак Л. З., Ворожбит А. В.), MON order No. 1090
of 06.09.2023.

This file covers **only the programming sections**. The rest of each year (hardware, cloud
services, web layout, 3D modelling, media, digital safety) is out of scope for this platform.

## Scale of the addressable content

| Grade | Section | Lessons | Position in year | Hours/week |
|---|---|---|---|---|
| 7 | Графічне програмування | 25–46 (22) | Semester 2 | 1.5 |
| 8 | Алгоритми та їх коди (розділ 5) | 43–61 (19) | Late semester 2 | see note |
| 9 | Програмні проєкти | 24–44 (21) | Mid-year | 1.5 |

About 62 lessons of programming across three years. Of those, roughly 20 are project work
where students build something larger — the platform supports the other ~40 directly and is at
best a reference during project lessons.

**All three grades reach programming in the second half of the year.** Nothing needs to be
ready in the autumn term, and the peak load falls in roughly January–March.

Document inconsistencies worth confirming with the teacher:
- The grade 8 plan is titled «2 ГОД» in the filename but says «1.5 год на тиждень» in the
  header, while listing 70 lessons — a count that implies 2 hours a week.
- The grade 8 numbering skips 28 and has two rows numbered 62.

## Grade 7 — «Графічне програмування» (lessons 25–46)

Turtle graphics is the spine of this section, not an optional extra.

| # | Topic | Platform topic |
|---|---|---|
| 25 | Середовище програмування: функції та можливості | intro |
| 26 | Основні команди мови програмування. Робота зі змінними | variables |
| 27 | Арифметичні оператори | arithmetic |
| 28 | Лінійний алгоритм | linear |
| 29 | Лінійний алгоритм. Черепашача графіка | turtle-basics |
| 30 | Алгоритм створення зображень за допомогою модуля Turtle | turtle-basics |
| 31–32 | Реалізація алгоритмів з розгалуженням. Умовний оператор if | conditions |
| 33 | Умовний оператор if в графічному модулі Turtle | turtle-conditions |
| 34–35 | Алгоритми з повторенням. Оператор циклу while | loops-while |
| 36–37 | Алгоритми з повторенням. Оператор циклу for | loops-for |
| 38 | Алгоритм з повторенням в графічному модулі Turtle | turtle-loops |
| 39 | Вкладені умови. Множинне розгалуження | conditions-nested |
| 40 | Тестування та налагодження. Синтаксичні та логічні помилки. Покрокове виконання | debugging |
| 41–42 | Динамічна графіка (анімації) | turtle-animation |
| 43–46 | Проєкт 1, Проєкт 2 | (project lessons) |

Note on lesson 40: the programme explicitly asks for **покрокове виконання програми**
(step-by-step execution). The platform decided against live stepping. For this one lesson,
either accept a gap and teach it outside the platform, or cover it with `predict` and `fix`
tasks, which exercise the same reasoning without an interpreter-level stepper.

## Grade 8 — «Алгоритми та їх коди» (lessons 43–61)

Console-based and `input()`-driven throughout. No turtle. In effect this repeats the grade 7
material in a text-output setting, then applies it to four applied projects.

| # | Topic | Platform topic |
|---|---|---|
| 43 | Середовища для написання коду. Транслятори. Програмний проєкт | intro |
| 44 | Мова програмування. Поняття змінної. Типи даних | variables, types |
| 45 | Введення та виведення даних. Присвоєння | io |
| 46 | Арифметичні операції. Математичні функції | arithmetic |
| 47 | Логічний тип даних. Операції відношень. Логічні оператори | booleans |
| 48–49 | Команда розгалуження | conditions |
| 50–51 | Команди повторення | loops-while, loops-for |
| 52 | Коментування програмного коду | comments |
| 53–55 | Проєкт 1: розв'язування квадратних рівнянь | (project) |
| 56–57 | Проєкт 2: індекс маси тіла | (project) |
| 58–59 | Проєкт 3: розрахунок вартості розробки сайту | (project) |
| 60–61 | Проєкт 4: додаток для замовлення PyPizza | (project) |

All four projects are input → compute → output. `input()` is therefore not a nice-to-have in
the runner — it is the dominant interaction mode for an entire grade.

## Grade 9 — «Програмні проєкти» (lessons 24–44)

| # | Topic | Platform topic |
|---|---|---|
| 24 | Повторення основ Python. Структура програми | review |
| 25 | Списки: оголошення, доступ, додавання, видалення. Ітерація: for, підрахунок, сумування | lists, lists-iteration |
| 26 | Пошук у списках. Максимум/мінімум, умови. Сортування списків | lists-search, lists-sort |
| 27 | Генерація списків: range, random. Практична робота | lists-generate |
| 28 | Рядки: оголошення, методи, індексація | strings |
| 29 | Маніпуляції з рядками: пошук, заміна, split/join | strings-methods |
| 29 | Шифрування: шифр Цезаря. Текстові повідомлення з параметрами | strings-cipher |
| 30 | Практична робота: обробка тексту | strings |
| 31–33 | Ідея проєкту, пріоритезація, структура, бібліотеки random/turtle/time | (project setup) |
| 34 | Проєкт з використанням turtle | turtle |
| 35 | Гра з використанням random | random |
| 36 | Тестування програм. try-except, перевірка вводу | exceptions |
| 37 | Добір тестових даних. Таблиця тестування | testing |
| 38 | Оцінювання правильності. Документація. Коментарі | testing, comments |
| 39–44 | Робота над проєктом, захист, рефлексія | (project lessons) |

## Consequences for the platform

These three documents change earlier decisions, three in total.

**1. Turtle is not optional, and it outranks the 8×8 grid.**

Turtle appears in grade 7 lessons 29, 30, 33, 38, 41–42 and again in grade 9 lesson 34. It is
the curriculum's own visual layer. The invented grid-and-character world was a reasonable idea
in the abstract, but it is a second visual system competing with the one the teacher is
required to teach.

Revised position: **build turtle first, treat the grid as optional**. The grid's advantage was
that it is trivially checkable (did the character reach the goal). Turtle is checkable too, via
the same post-hoc action log — record the sequence of pen movements and compare against a
reference run rather than against pixels.

This also strengthens the Skulpt choice: Skulpt ships a turtle module that renders to a canvas
out of the box. Pyodide does not — turtle there means writing a renderer. Confirm the Skulpt
turtle module behaves acceptably during the spike, alongside the language-coverage checks.

**2. `input()` is a first-class requirement, not an edge case.**

Every grade 8 project is input-driven, and grade 9 lesson 36 is explicitly about validating
user input. The custom input-field approach (collect values up front, feed as `stdin[]`) covers
the straightforward cases but not `input()` inside a loop with a prompt that depends on earlier
output. Decide during the spike whether Skulpt's `inputfun` hook can drive a real prompt-response
exchange in the UI, because a whole grade depends on it.

**3. File delivery attaches at two specific points, not everywhere.**

Grade 8 lesson 43 («Середовища для написання коду. Транслятори») is the introduction — the
lesson is literally about editors and translators, so a task that hands the student a real
`.py` file to edit outside the browser belongs exactly there. Grade 9 lessons 31–44 (the project
block) are the main use: a project spans multiple sessions and outgrows a browser tab well before
lesson 44. **Not grade 7** — grade 7 is turtle-first and entirely graphical, and nothing in its
lesson list (25–46) asks students to work with files.

The editor is IDLE: it is already installed on the classroom machines and colleagues already
teach with it. The platform adapts to IDLE rather than recommending a replacement — introducing
a second editor into a classroom that already has a working one is a cost with no matching
benefit here. See AI_CONTEXT.md's "File Delivery" for the mechanism.

## Topic tagging

Platform topics carry `grade_tags`, and the overlap between grades 7 and 8 is substantial —
variables, arithmetic, conditions, and loops are taught twice, once graphically and once in the
console. Those topics should be tagged `{7,8}` with two task sets distinguished by output mode
rather than duplicated as separate topics.

Suggested topic list with tags:

```
intro              {7,8}
variables          {7,8}
types              {8}
arithmetic         {7,8}
io                 {8}
booleans           {8}
linear             {7}
conditions         {7,8}
conditions-nested  {7}
loops-while        {7,8}
loops-for          {7,8}
comments           {8,9}
debugging          {7,9}
turtle-basics      {7}
turtle-conditions  {7}
turtle-loops       {7}
turtle-animation   {7}
lists              {9}
lists-iteration    {9}
lists-search       {9}
lists-sort         {9}
lists-generate     {9}
strings            {9}
strings-methods    {9}
strings-cipher     {9}
random             {9}
exceptions         {9}
testing            {9}
```

Twenty-eight topics. At roughly twelve tasks each, that is ~340 tasks for full coverage — which
is a multi-year content effort, not a two-week one. Start with the grade 7 second-semester
block (intro through loops-for, plus turtle-basics), which is about nine topics and the first
thing that will actually be used in a classroom.
