import { describe, expect, it } from 'vitest';
import { parseInNode } from './node-skulpt';
import type { PyAstNode, PyAstValue } from './types';

function tree(source: string): PyAstNode {
  const parsed = parseInNode(source);
  if (!parsed.ok) throw new Error(`did not parse: ${parsed.error.message}`);
  return parsed.ast;
}

function all(node: PyAstValue, type: string, out: PyAstNode[] = []): PyAstNode[] {
  if (Array.isArray(node)) node.forEach((n) => all(n, type, out));
  else if (node !== null && typeof node === 'object') {
    if (node.type === type) out.push(node);
    Object.values(node.fields).forEach((v) => all(v, type, out));
  }
  return out;
}

describe('skulptToAst — CPython-shaped output', () => {
  it('normalizes Num, Str and NameConstant to Constant', () => {
    const constants = all(tree('x = [1, 2.5, "a", True, None]\n'), 'Constant').map((c) => c.fields.value);
    expect(constants).toEqual([1, 2.5, 'a', true, null]);
    expect(all(tree('x = 1\n'), 'Num')).toEqual([]);
  });

  it('drops the Index wrapper CPython 3.9 removed', () => {
    const [sub] = all(tree('xs = [1]\nprint(xs[0])\n'), 'Subscript');
    expect((sub.fields.slice as PyAstNode).type).toBe('Constant');
    expect(all(tree('xs = [1]\nprint(xs[0])\n'), 'Index')).toEqual([]);
  });

  it('names operators and contexts as field-less nodes', () => {
    const ast = tree('x = 1 + 2\nprint(x < 3 and not x)\n');
    expect(all(ast, 'Add')).toHaveLength(1);
    expect(all(ast, 'Lt')).toHaveLength(1);
    expect(all(ast, 'And')).toHaveLength(1);
    expect(all(ast, 'Not')).toHaveLength(1);
    expect(all(ast, 'Store')).toHaveLength(1);
    expect(all(ast, 'Add')[0]).toEqual({ type: 'Add', line: null, fields: {} });
  });

  it('encodes the f-string conversion flag as CPython does', () => {
    const conversions = all(tree('x = 1\nprint(f"{x!r} {x}")\n'), 'FormattedValue').map((f) => f.fields.conversion);
    expect(conversions).toEqual([114, -1]);
  });

  it('gives expressions inside an f-string the f-string\'s line, not line 1', () => {
    const names = all(tree('x = 1\n\nprint(f"{x}")\n'), 'Name').filter((n) => n.fields.id === 'x');
    expect(names.map((n) => n.line)).toEqual([1, 3]);
  });

  it('reports a SyntaxError as the answer, with its line', () => {
    expect(parseInNode('x = 1\nif x\n')).toEqual({
      ok: false,
      error: expect.objectContaining({ type: 'SyntaxError', line: 2 })
    });
  });
});
