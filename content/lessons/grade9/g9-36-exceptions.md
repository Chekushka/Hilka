Користувач може ввести що завгодно — і програма падає:

```notes
n = int(input())    # ввели «п'ять» → ValueError
print(10 // 0)      # → ZeroDivisionError
```

---

`try` — спробуй, `except` — що робити, якщо не вийшло:

```notes
text = input()
try:
    n = int(text)             # тут може бути помилка
    print(n * n)
except ValueError:            # саме ця помилка
    print("Це не число")
```

---

```guess
try:
    x = int("12")
    print(x + 1)
except ValueError:
    print("помилка")
print("кінець")
-- *
13
кінець
--
помилка
кінець
--
13
-- чому
«12» — справжнє число, помилки немає, тож `except` пропускається. «кінець» виводиться завжди.
```

---

```guess
try:
    x = int("12а")
    print(x + 1)
except ValueError:
    print("помилка")
print("кінець")
-- *
помилка
кінець
--
13
кінець
--
помилка
-- чому
На `int` сталася помилка — решта рядків у `try` пропускається, одразу `except`.
```

---

`except` ловить лише **названу** помилку:

```notes
try:
    print(a // b)
except ZeroDivisionError:     # ділення на нуль
    print("На нуль ділити не можна")
```

`except ValueError` тут не допоможе — програма впаде.

---

Питати, доки не введуть правильно:

```notes
n = 0
while not (1 <= n <= 10):
    try:
        n = int(input())
    except ValueError:
        print("Це не число")
```

---

```remember
`try:` — код, де може статися помилка
`except ValueError:` — не те значення (`int("abc")`)
`except ZeroDivisionError:` — ділення на нуль
```
