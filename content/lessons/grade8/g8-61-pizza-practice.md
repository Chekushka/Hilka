Промокод `PYTHON` — знижка 15%: `total * 0.85`. Знижка — **до** перевірки доставки.

```guess
total = 580
code = "PYTHON"
if code == "PYTHON":
    total = total * 0.85
if total < 500:
    total = total + 50
print(round(total, 2))
-- *
543.0
--
493.0
--
580
-- чому
580 · 0.85 = 493.0 — менше 500, тож +50 доставки.
```

---

Сума не росте? Перевір рядок із додаванням:

```guess
total = 0
price = 150
total = price
price = 180
total = price
print(total)
-- *
180
--
330
--
150
-- чому
`total = price` **замінює** суму. Додає — `total = total + price`.
```

---

```remember
`total * 0.85` — знижка 15%
`total = price` — замінити суму
`total = total + price` — додати до суми
```
