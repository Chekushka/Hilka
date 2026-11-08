`for` + `range()` перебирає числа:

```notes
for i in range(5):        # 0, 1, 2, 3, 4
    print(i)
for i in range(1, 11):    # 1 … 10, кінець не входить
    print(i)
```

---

```guess
for i in range(1, 4):
    print(i * i)
-- *
1
4
9
--
0
1
4
--
1
4
9
16
-- чому
`range(1, 4)` — 1, 2, 3. Кожне × саме на себе.
```

---

Відома кількість введень — `for` читає по одному:

```notes
n = int(input())
total = 0                          # один раз — до циклу
for i in range(n):
    total = total + int(input())   # щоразу — всередині
print(total)                       # один раз — після
```

---

```guess
total = 0
for i in range(3):
    total = total + 5
print(total)
-- *
15
--
5
10
15
--
5
-- чому
`print` без відступу — після циклу, один раз.
```

---

```remember
`range(1, 11)` — від 1 до 10
З відступом — щоразу. Без відступу — один раз.
```
