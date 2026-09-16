/**
 * The `expr` check's execution side.
 *
 * `evaluateCheck` cannot run Python itself — lib/checker/ is pure and never
 * imports Skulpt — so an `expr` check ("must evaluate truthy after the run")
 * has to be evaluated here, inside the same run that produced the state it
 * reads. worker.ts appends a small epilogue that imports this module and
 * calls `record(index, <expr>)` inside a try/except for every expr the
 * checks asked for, in the same global scope the program just finished with.
 *
 * A separate module rather than printing markers to stdout: stdout is the
 * program's own output and must not carry diagnostic text a check invented.
 */

export interface ExprRecorder {
  /** Keyed by the epilogue's statement index, not the expr text itself. */
  results: Record<number, boolean>;
}

export function createExprRecorder(): ExprRecorder {
  return { results: {} };
}

/** The path Skulpt looks up when the epilogue says `import _hilka_expr`. */
export const EXPR_MODULE_PATH = 'src/lib/_hilka_expr.js';

export const EXPR_MODULE_SOURCE = `
var $builtinmodule = function (name) {
  var mod = {};
  mod.record = new Sk.builtin.func(function (index, value) {
    var i = Sk.ffi.remapToJs(index);
    self.__exprRecorder__.results[i] = Sk.misceval.isTrue(value);
    return Sk.builtin.none.none$;
  });
  return mod;
};
`;

/**
 * One statement per expr, each guarded so a bad expr (a NameError, a
 * ZeroDivisionError) records false instead of aborting the ones after it.
 * Appended at column 0, which is always a valid place for the next
 * top-level statement regardless of what block the program's own code ends
 * inside.
 */
export function buildExprEpilogue(exprs: readonly string[]): string {
  if (exprs.length === 0) {
    return '';
  }
  const lines = ['import _hilka_expr'];
  exprs.forEach((expr, index) => {
    lines.push('try:');
    lines.push(`    _hilka_expr.record(${index}, ${expr})`);
    lines.push('except Exception:');
    lines.push(`    _hilka_expr.record(${index}, False)`);
  });
  return '\n' + lines.join('\n') + '\n';
}
