Порівняння дає `True` або `False` — тип `bool`.

```notes
print(5 > 3)    # True
print(2 == 7)   # False: == — два знаки!
```

---

Логічні оператори:

- `and` — правдиві **обидві** частини
- `or` — правдива **хоча б одна**
- `not` — навпаки

---

```guess
age = 13
print(age > 12 and age < 13)
-- *
False
--
True
--
13
-- чому
13 < 13 — неправда. `and` хоче обидві правди.
```

---

```guess
x = 5
print(x == 5 or x > 100)
print(not x == 5)
-- *
True
False
--
True
True
--
False
False
-- чому
`or` вистачає однієї правди. `not` перевертає True на False.
```

---

```remember
`and` — обидві правдиві
`or` — хоча б одна
`not` — навпаки
`==` — порівняти
```
