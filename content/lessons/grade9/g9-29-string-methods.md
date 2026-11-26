**Методи** — те, що рядок уміє сам:

```notes
s = "Привіт, Світе"
print(s.upper())             # ПРИВІТ, СВІТЕ
print(s.lower())             # привіт, світе
print(s.replace("і", "i"))   # заміна всіх входжень
print(s.find("С"))           # 8 — номер, або -1
print(s.count("і"))          # 2
```

---

```guess
s = "банан"
print(s.count("а"), s.find("н"), s.replace("н", "м"))
-- *
2 2 бамам
--
2 3 бамам
--
3 2 бамам
--
2 2 банан
-- чому
«а» двічі; перша «н» — на місці 2; `replace` міняє **усі** «н».
```

---

`split` ріже рядок на **список**, `join` склеює назад:

```notes
words = "я люблю Python".split()   # ['я', 'люблю', 'Python']
print(len(words))                  # 3 слова
print("-".join(words))             # я-люблю-Python
```

---

```guess
parts = "2025-11-26".split("-")
print(parts[1])
-- *
11
--
2025
--
-
--
26
-- чому
`split("-")` ріже за дефісом: `['2025', '11', '26']`. Номер 1 — «11».
```

---

Числа в одному рядку — `split`, а потім `int`:

```notes
parts = input().split()       # "3 8 1" → ['3', '8', '1']
total = 0
for p in parts:
    total = total + int(p)    # без int було б склеювання
print(total)
```

---

```guess
parts = "4 5".split()
print(parts[0] + parts[1])
-- *
45
--
9
--
4 5
-- чому
Після `split` це ще **рядки**: «4» + «5» = «45».
```

---

```remember
`upper`, `lower`, `replace`, `find`, `count` — методи рядка
`split()` — рядок → список, `" ".join(список)` — назад
Шматки після `split` — текст; для чисел потрібен `int`
```
