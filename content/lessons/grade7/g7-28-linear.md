**Лінійний алгоритм** — три кроки по черзі: **зчитати → обчислити → вивести**.

```notes
length = int(input())    # 1. зчитати
width = int(input())
area = length * width    # 2. обчислити
print(area)              # 3. вивести
```

---

Обміняти два значення можна через третю змінну — як переливати воду через порожню склянку:

```memory
a = 3
> a = 3
b = 8
> b = 8
temp = a
> temp = 3
a = b
> a = 8
b = temp
> b = 3
```

---

```guess
length = 4
width = 3
area = length * width
print(area)
-- *
12
--
7
--
length * width
-- чому
`print` виводить значення змінної, а не формулу.
```

---

```remember
Зчитати → обчислити → вивести.
`print(area)` — виводить значення, а не формулу
```
