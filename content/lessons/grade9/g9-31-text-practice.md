Обробка тексту — це завжди одні й ті самі цеглинки:

```notes
text = input().lower()     # не розрізняти великі й малі
for ch in text:            # по кожній літері
    if ch in "аеєиіїоуюя": # чи належить до групи
        ...
words = text.split()       # по кожному слову
```

---

```guess
text = "Ой у лузі"
count = 0
for ch in text.lower():
    if ch in "аеєиіїоуюя":
        count = count + 1
print(count)
-- *
4
--
3
--
9
-- чому
Голосні: о, у, у, і. Велике «О» стало малим завдяки `lower()`.
```

---

Перевірки символів:

```notes
print("7".isdigit())     # True — цифра
print("Ж".isupper())     # True — велика літера
print("ж".isalpha())     # True — літера
print(",".isalpha())     # False
```

---

```guess
words = "київ львів одеса".split()
first = ""
for w in words:
    first = first + w[0]
print(first.upper())
-- *
КЛО
--
кло
--
КИЇВ
-- чому
Беремо першу літеру кожного слова й наприкінці робимо їх великими.
```

---

```remember
`lower()` — щоб «А» і «а» були однакові
`isdigit()`, `isupper()`, `isalpha()` — що це за символ
`split()` + `join()` — працювати зі словами
```
