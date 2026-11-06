Завершуємо PyPizza: додаємо **промокод** і збираємо застосунок повністю.

Промокод `PYTHON` дає знижку 15% — це множення на 0.85. Знижку застосовуємо **до** перевірки доставки: сума після знижки може стати меншою за 500, і тоді доставка вже платна.

```python
code = input("Промокод: ")
if code == "PYTHON":
    total = total * 0.85
if total < 500:
    total = total + 50
print(round(total, 2))
```

---

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
580 · 0.85 = 493.0 — це менше за 500, тож додається доставка: 543.0.
```

---

Коли в циклі сума не росте, а щоразу дорівнює останній ціні, перевір рядок із додаванням: `total = price` **замінює** суму, а `total = total + price` — **додає** до неї.

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
`total = price` щоразу кладе в `total` нове значення, і старе зникає. Щоб накопичувати, потрібно `total = total + price`.
```

```remember
Знижку застосовуємо до перевірки доставки.
`total = price` замінює суму, `total = total + price` — додає до неї.
```
