Ігри потребують **випадковості** — модуль `random`:

```notes
import random
dice = random.randint(1, 6)                  # 1…6, обидві межі входять
move = random.choice(["камінь", "папір"])    # випадковий елемент
x = random.random()                          # дробове від 0 до 1
```

---

```guess
import random
x = random.randint(3, 3)
print(x + 1)
-- *
4
--
3
--
випадкове число
-- чому
Між 3 і 3 є лише одне ціле — 3. Тож відповідь завжди 4.
```

---

Без `import random` нічого не вийде:

```notes
roll = random.randint(1, 6)    # NameError: name 'random' is not defined
```

Перший рядок програми — `import random`.

---

Каркас гри — вибір комп'ютера і правила:

```notes
player = input()
computer = random.choice(["камінь", "ножиці", "папір"])
if player == computer:
    result = "нічия"
elif ...:                      # три виграшні пари
    result = "перемога"
else:
    result = "поразка"
```

---

```guess
player = "папір"
computer = "камінь"
if player == computer:
    print("нічия")
elif player == "папір" and computer == "камінь":
    print("перемога")
else:
    print("поразка")
-- *
перемога
--
поразка
--
нічия
-- чому
Ходи різні, а папір б'є камінь — спрацювала гілка `elif`.
```

---

Випадковий результат не вгадаєш — перевіряй, **чи він можливий**: кубик дає від 1 до 6, у списку з 20 кидків — 20 елементів.

---

```remember
`import random` — першим рядком
`random.randint(a, b)` — ціле від a до b включно
`random.choice(список)` — випадковий елемент
```
