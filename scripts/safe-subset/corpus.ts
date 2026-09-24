/**
 * The evidence behind the file-delivery safe subset (docs/TASK_SCHEMA.md,
 * "Safe subset"). Each entry runs on Skulpt (with Hilka's own stubs) and on
 * real CPython; an entry confirms the names it lists only if both print the
 * same thing. `scripts/safe-subset/confirm.ts` runs it and refuses an
 * allow-list entry nothing here confirms.
 *
 * Kinds match lib/task/file-lint.ts's allow-lists: `node` is a CPython `ast`
 * node type, `builtin` a builtin name, `method` an attribute called on a
 * value, `module` a module attribute (`math.sqrt`), `format` a format-spec
 * pattern id.
 *
 * Output is deliberately printed through `str()`/`repr()` of ints, strings
 * and booleans wherever possible: float repr differs between the engines (see
 * the `float-repr` entry), which is a finding of its own, not a reason to
 * fail every entry that happens to print a float.
 */
export interface CorpusEntry {
  id: string;
  confirms: { kind: 'node' | 'builtin' | 'method' | 'module' | 'format'; names: string[] };
  code: string;
}

const node = (names: string[]) => ({ kind: 'node' as const, names });
const builtin = (names: string[]) => ({ kind: 'builtin' as const, names });
const method = (names: string[]) => ({ kind: 'method' as const, names });
const mod = (names: string[]) => ({ kind: 'module' as const, names });
const format = (names: string[]) => ({ kind: 'format' as const, names });

export const CORPUS: CorpusEntry[] = [
  // ---- statements and expressions
  {
    id: 'core-statements',
    confirms: node(['Module', 'Expr', 'Assign', 'AugAssign', 'If', 'While', 'For', 'Break', 'Continue', 'Pass', 'Name', 'Constant', 'Call', 'Load', 'Store']),
    code: `x = 0
while True:
    x += 1
    if x > 5:
        break
    elif x == 2:
        continue
    else:
        pass
for i in range(3):
    x = x + i
else:
    print("done", x)
`
  },
  {
    id: 'operators-arith',
    confirms: node(['BinOp', 'UnaryOp', 'Add', 'Sub', 'Mult', 'Div', 'FloorDiv', 'Mod', 'Pow', 'USub', 'UAdd']),
    code: `a, b = 17, 5
print(a + b, a - b, a * b, a // b, a % b, a ** 2, -a, +b, -7 // 2, -7 % 2)
print(a / b == 3.4, 7 / 2 == 3.5, 2 ** -1 == 0.5)
`
  },
  {
    id: 'operators-bool-compare',
    confirms: node(['BoolOp', 'Compare', 'And', 'Or', 'Not', 'Eq', 'NotEq', 'Lt', 'LtE', 'Gt', 'GtE', 'In', 'NotIn', 'Is', 'IsNot', 'IfExp']),
    code: `x = 5
print(x > 1 and x < 10, x < 1 or x == 5, not x, 1 < x <= 5, x != 4, x >= 5)
print(3 in [1, 2, 3], 4 not in [1], x is None, x is not None)
print("так" if x > 3 else "ні")
`
  },
  {
    id: 'operators-bitwise',
    confirms: node(['BitAnd', 'BitOr', 'BitXor', 'LShift', 'RShift', 'Invert']),
    code: `print(6 & 3, 6 | 3, 6 ^ 3, 1 << 4, 32 >> 2, ~5)
`
  },
  {
    id: 'functions',
    confirms: node(['FunctionDef', 'Return', 'arguments', 'arg', 'keyword', 'Global']),
    code: `total = 0
def add(a, b=10):
    global total
    total += a + b
    return a + b
print(add(1), add(1, b=2), add(b=3, a=4), total)
def nothing():
    return
print(nothing())
`
  },
  {
    id: 'lambda',
    confirms: node(['Lambda']),
    code: `words = ["кіт", "я", "собака"]
print(sorted(words, key=lambda w: len(w)))
sq = lambda n: n * n
print(sq(7))
`
  },
  {
    id: 'containers',
    confirms: node(['List', 'Tuple', 'Dict', 'Set', 'Subscript', 'Slice', 'Del', 'Delete', 'Starred']),
    code: `xs = [10, 20, 30, 40]
t = (1, 2)
d = {"a": 1, "b": 2}
s = {3, 1, 2}
print(xs[0], xs[-1], xs[1:3], xs[::-1], xs[::2], t[1], d["b"], sorted(s))
xs[0] = 5
del xs[1]
del d["a"]
print(xs, d, len(s))
first, *rest = xs
print(first, rest, [*t, 9])
`
  },
  {
    id: 'comprehensions',
    confirms: node(['ListComp', 'DictComp', 'SetComp', 'GeneratorExp', 'comprehension']),
    code: `print([i * i for i in range(5) if i % 2 == 0])
print({k: len(k) for k in ["ab", "c"]})
print(sorted({c for c in "banana"}))
print(sum(i for i in range(10)))
`
  },
  {
    id: 'try-except',
    confirms: node(['Try', 'ExceptHandler', 'Raise']),
    code: `for raw in ["5", "x", "0"]:
    try:
        n = int(raw)
        print(10 // n)
    except ValueError:
        print("не число")
    except ZeroDivisionError as e:
        print("ділення на нуль")
    else:
        print("ок")
    finally:
        print("далі")
try:
    raise ValueError("погано")
except Exception as e:
    print(str(e))
`
  },
  {
    id: 'assert',
    confirms: node(['Assert']),
    code: `assert 1 + 1 == 2
try:
    assert 1 == 2, "не так"
except AssertionError as e:
    print(str(e))
`
  },
  {
    id: 'imports',
    confirms: node(['Import', 'ImportFrom', 'alias', 'Attribute']),
    code: `import math
import random as rnd
from math import sqrt, floor as fl
print(sqrt(16) == 4, fl(2.7), rnd.randint(1, 1))
`
  },
  {
    id: 'star-import',
    confirms: node(['ImportFrom', 'alias']),
    code: `from math import *
from random import *
print(sqrt(16) == 4, floor(2.5), randint(3, 3))
`
  },
  {
    id: 'fstrings',
    confirms: node(['JoinedStr', 'FormattedValue']),
    code: `name = "світ"
n = 7
print(f"Привіт, {name}! {n * 2} {name!r} {n!s}")
`
  },

  // ---- builtins
  {
    id: 'builtins-core',
    confirms: builtin(['print', 'int', 'float', 'str', 'bool', 'len', 'range', 'abs', 'round', 'max', 'min', 'sum', 'sorted', 'reversed', 'enumerate', 'zip', 'list', 'dict', 'tuple', 'set']),
    code: `print(int("42") + 1, int(3.9), str(5) + "x", bool(0), bool("a"), len("Привіт"))
print(list(range(2, 10, 3)), abs(-3), round(2.675), round(7.5), round(8.5), max(3, 9), min([4, 2]), sum([1, 2, 3]))
print(sorted([3, 1, 2], reverse=True), list(reversed([1, 2])), list(enumerate("ab")), list(zip([1, 2], "ab")))
print(dict(a=1), tuple([1, 2]), sorted(set([2, 2, 1])), float("2") == 2.0)
print("a", "b", sep="-", end="!\\n")
`
  },
  {
    id: 'builtins-more',
    confirms: builtin(['type', 'isinstance', 'any', 'all', 'chr', 'ord', 'divmod', 'pow', 'map', 'filter']),
    code: `print(type(5) == int, isinstance("a", str), any([0, 1]), all([1, 0]), chr(1041), ord("A"))
print(divmod(17, 5), pow(2, 10), list(map(str, [1, 2])), list(filter(lambda x: x > 1, [1, 2, 3])))
`
  },
  {
    id: 'builtins-input',
    confirms: builtin(['input']),
    // Both engines read "Оля" from stdin (the confirm script feeds it).
    code: `name = input("Як тебе звати? ")
print("Привіт,", name)
`
  },
  {
    id: 'builtins-exceptions',
    confirms: builtin(['Exception', 'ValueError', 'TypeError', 'ZeroDivisionError', 'IndexError', 'KeyError', 'NameError', 'AssertionError']),
    code: `for bad in [lambda: int("x"), lambda: "a" + 1, lambda: 1 // 0, lambda: [][1], lambda: {}["k"], lambda: undefined_name]:
    try:
        bad()
    except (ValueError, TypeError, ZeroDivisionError, IndexError, KeyError, NameError) as e:
        print(type(e) == ValueError, type(e) == TypeError, type(e) == ZeroDivisionError, type(e) == IndexError, type(e) == KeyError, type(e) == NameError)
print(issubclass(AssertionError, Exception))
`
  },

  // ---- methods on built-in values
  {
    id: 'methods-str-case',
    confirms: method(['upper', 'lower', 'capitalize', 'strip', 'lstrip', 'rstrip']),
    code: `s = "  Привіт, світ  "
print(repr(s.upper()), repr(s.lower()), repr(s.strip()), repr(s.lstrip()), repr(s.rstrip()))
print("кіт і пес".capitalize(), "ПЕС".capitalize(), "їжак".upper(), "ҐАНОК".lower())
`
  },
  {
    id: 'methods-str-search',
    confirms: method(['split', 'join', 'replace', 'find', 'index', 'count', 'startswith', 'endswith']),
    code: `t = "кіт і пес"
print(t.split(), t.split("і"), "-".join(["a", "b"]), t.replace("кіт", "лис"), "a,b,,c".split(","))
print(t.find("і"), t.find("я"), t.index("пес"), t.count("і"), t.startswith("кіт"), t.endswith("с"))
`
  },
  {
    id: 'methods-str-digit-space',
    confirms: method(['isdigit', 'isspace']),
    code: `print("123".isdigit(), "12a".isdigit(), "".isdigit(), "-5".isdigit(), " ".isspace(), " \\t\\n".isspace(), "".isspace(), "ж ".isspace())
`
  },
  {
    id: 'methods-str-letter-predicates',
    // Skulpt's own are ASCII-only; these run lib/runner/modules/str-unicode.ts.
    confirms: method(['isalpha', 'isalnum', 'isupper', 'islower', 'istitle']),
    code: `for s in ["абв", "їжак", "Ґанок", "м'ята", "ж1", "abc", "a1", "", " ", "1", "ЖУК", "ЖУК 1", "жук", "Жук", "ЖУк", "Жук Їжак", "123", "ß", "ǅ", "ǅemal", "Σίσυφος"]:
    print(repr(s), s.isalpha(), s.isalnum(), s.isupper(), s.islower(), s.istitle())
`
  },
  {
    id: 'methods-str-case-transforms',
    confirms: method(['title', 'swapcase']),
    code: `for s in ["кіт і пес", "ґанок-їжак", "they're bill's", "hello wORLD", "straße", "ǆemal", "Привіт, СВІТ", "3кіт", "ﬁre", ""]:
    print(repr(s.title()), repr(s.swapcase()))
`
  },
  {
    id: 'methods-str-unicode-sweep',
    // Every character of Latin, Greek and Cyrillic, one at a time. U+019B (ƛ)
    // is left out: it gained an uppercase in Unicode 16, which the browser's
    // JS engine knows and CPython 3.11–3.13 (Unicode 14–15.1) do not — a
    // Unicode-version difference, not a runner bug.
    confirms: method(['isalpha', 'isalnum', 'isupper', 'islower', 'istitle', 'title', 'swapcase']),
    code: `chars = [chr(i) for i in list(range(0x20, 0x250)) + list(range(0x370, 0x530)) if i != 0x19B]
print("".join("1" if c.isalpha() else "0" for c in chars))
print("".join("1" if c.isalnum() else "0" for c in chars))
print("".join("1" if c.isupper() else "0" for c in chars))
print("".join("1" if c.islower() else "0" for c in chars))
print("".join("1" if c.istitle() else "0" for c in chars))
print("|".join(c.title() for c in chars))
print("|".join(c.swapcase() for c in chars))
`
  },
  {
    id: 'methods-str-padding',
    confirms: method(['center', 'ljust', 'rjust', 'zfill']),
    code: `print(repr("ab".center(6)), repr("ab".ljust(4)), repr("ab".rjust(4)), "7".zfill(3), repr("жук".center(7, "*")))
`
  },
  {
    id: 'methods-list',
    confirms: method(['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'sort', 'reverse', 'copy']),
    code: `xs = [3, 1, 2]
xs.append(5); xs.extend([7, 0]); xs.insert(0, 9); xs.remove(1)
print(xs, xs.pop(), xs.pop(0), xs.index(2), xs.count(3))
ys = xs.copy(); xs.sort(); ys.sort(reverse=True); xs.reverse()
print(xs, ys)
ys.clear()
print(ys)
`
  },
  {
    id: 'methods-dict',
    confirms: method(['keys', 'values', 'items', 'get', 'update', 'setdefault']),
    code: `d = {"a": 1}
d.update({"b": 2}); d.setdefault("c", 3); d.setdefault("a", 9)
print(list(d.keys()), list(d.values()), list(d.items()), d.get("z"), d.get("z", 0), d.pop("a"), d)
`
  },
  {
    id: 'methods-format',
    confirms: method(['format']),
    code: `print("{} і {}".format("кіт", 3), "{0}{1}{0}".format("a", "b"), "{name}!".format(name="Оля"))
`
  },

  // ---- modules
  {
    id: 'module-math',
    confirms: mod(['math.sqrt', 'math.pi', 'math.e', 'math.floor', 'math.ceil', 'math.pow', 'math.fabs', 'math.trunc', 'math.hypot', 'math.factorial', 'math.gcd', 'math.radians', 'math.degrees', 'math.sin', 'math.cos', 'math.tan', 'math.log', 'math.log10']),
    code: `import math
print(math.sqrt(16) == 4, round(math.pi, 4), round(math.e, 4), math.floor(2.7), math.ceil(2.1), math.floor(-2.5))
print(math.pow(2, 3) == 8, math.fabs(-2) == 2, math.trunc(-2.7), math.hypot(3, 4) == 5, math.factorial(5), math.gcd(12, 18))
print(round(math.radians(180), 4), round(math.degrees(math.pi)), round(math.sin(math.pi / 2)), round(math.cos(0)), round(math.tan(0)))
print(round(math.log(math.e)), round(math.log10(1000)))
`
  },
  {
    id: 'module-random',
    confirms: mod(['random.randint', 'random.random', 'random.choice', 'random.shuffle', 'random.uniform', 'random.randrange', 'random.sample', 'random.seed']),
    // Different generators, so only properties of the results can match.
    code: `import random
random.seed(1)
r = random.randint(1, 6)
xs = [1, 2, 3, 4]
random.shuffle(xs)
print(1 <= r <= 6, 0 <= random.random() < 1, random.choice("abc") in "abc", sorted(xs))
print(2 <= random.uniform(2, 3) <= 3, random.randrange(0, 10, 5) in (0, 5), len(random.sample(range(10), 3)))
`
  },
  {
    id: 'module-time',
    confirms: mod(['time.sleep', 'time.time']),
    code: `import time
start = time.time()
time.sleep(0.05)
print(time.time() >= start)
`
  },

  // ---- f-string format specs
  {
    id: 'format-fixed',
    confirms: format(['fixed']),
    code: `x = 3.14159
print(f"{x:.0f} {x:.1f} {x:.2f} {x:.3f} {22.857:.2f} {2.675:.2f} {1.005:.2f} {99.999:.2f}")
`
  },
  {
    id: 'format-int',
    confirms: format(['int']),
    code: `print(f"{42:d} {-7:d}")
`
  },
  {
    id: 'format-width',
    confirms: format(['width']),
    code: `print(f"[{7:5}] [{'ab':5}] [{'ab':>5}] [{'ab':<5}] [{'ab':^6}] [{7:05}] [{3.5:8.2f}]")
`
  },
  {
    id: 'format-grouping',
    confirms: format(['grouping']),
    code: `print(f"{1234567:,} {1234.5:,.2f}")
`
  },
  {
    id: 'format-percent',
    confirms: format(['percent']),
    code: `print(f"{0.256:%} {0.256:.1%}")
`
  },
  {
    id: 'format-exponent',
    confirms: format(['exponent']),
    code: `print(f"{12345.678:e} {12345.678:.2e}")
`
  },

  // ---- probes: confirm nothing (empty `names`), run to record what happens
  {
    id: 'float-repr',
    confirms: { kind: 'node', names: [] },
    code: `import math
print(math.sqrt(2), 0.1 + 0.2, 1 / 3, 2 / 3, 10 / 7)
`
  },
  {
    id: 'format-fixed-exact-tie',
    confirms: { kind: 'format', names: [] },
    // Exactly representable halves: CPython rounds half to even here.
    code: `print(f"{0.5:.0f} {1.5:.0f} {2.5:.0f} {-0.5:.0f} {0.125:.2f} {0.375:.2f}")
`
  },
  {
    id: 'round-exact-tie',
    confirms: { kind: 'builtin', names: [] },
    code: `print(round(0.5), round(1.5), round(2.5), round(-0.5), round(0.125, 2), round(0.375, 2))
`
  },
  {
    id: 'fstring-self-documenting',
    confirms: { kind: 'node', names: [] },
    code: `x = 5
print(f"{x=}")
`
  },
  {
    id: 'walrus',
    confirms: { kind: 'node', names: [] },
    code: `if (n := 5) > 3:
    print(n)
`
  },
  {
    id: 'match',
    confirms: { kind: 'node', names: [] },
    code: `x = 2
match x:
    case 1:
        print("one")
    case _:
        print("other")
`
  },
  {
    id: 'percent-format',
    confirms: { kind: 'node', names: [] },
    code: `print("%d %s %.2f" % (5, "a", 3.14159))
`
  },
  {
    id: 'class',
    confirms: { kind: 'node', names: [] },
    code: `class Pet:
    def __init__(self, name):
        self.name = name
print(Pet("Мурка").name)
`
  }
];

/** Stdin fed to both engines, for `builtins-input`. */
export const CORPUS_STDIN = ['Оля'];
