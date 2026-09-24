"""
Writes lib/task/cpython-names.json: the names CPython itself knows, so the
file-delivery linter can tell "valid Python Hilka cannot run" apart from a
typo (which is the student's error, surfaced at runtime, never a platform
limitation). Run with the classroom machine's interpreter when possible:

    python3 scripts/safe-subset/cpython_names.py

turtle is read from its source with `ast` rather than imported, so this also
works where tkinter is missing.
"""
import ast
import builtins
import json
import math
import pathlib
import platform
import random
import sys
import time

def public(module):
    return sorted(n for n in dir(module) if not n.startswith("_"))

def methods(tp):
    return sorted(n for n in dir(tp) if not n.startswith("_"))

turtle_path = pathlib.Path(sys.modules["os"].__file__).parent / "turtle.py"
tree = ast.parse(turtle_path.read_text(encoding="utf-8"))
turtle_names = set()
for node in tree.body:
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id in ("_tg_classes", "_tg_screen_functions", "_tg_turtle_functions", "_tg_utilities"):
                turtle_names.update(ast.literal_eval(node.value))
turtle_names.add("done")

out = {
    "python": platform.python_version(),
    "builtins": public(builtins),
    "methods": sorted(set(methods(str)) | set(methods(list)) | set(methods(dict)) | set(methods(set)) | set(methods(tuple)) | set(methods(int)) | set(methods(float))),
    "modules": {
        "math": public(math),
        "random": public(random),
        "time": public(time),
        "turtle": sorted(turtle_names),
    },
    "stdlib": sorted(sys.stdlib_module_names),
}
target = pathlib.Path(__file__).resolve().parents[2] / "lib" / "task" / "cpython-names.json"
target.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"wrote {target} from Python {out['python']}")
