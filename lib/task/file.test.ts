import { describe, expect, it } from 'vitest';
import { generateStarterFile, parseHeader, validateUpload } from './file';
import type { FileSpec } from './types';

const SPEC: FileSpec = { filename: 'bmi_fix.py', headerComment: true, maxBytes: 65536 };
const utf8 = (text: string) => new TextEncoder().encode(text);

describe('generateStarterFile', () => {
  const file = generateStarterFile({
    header: { taskId: 't-1', version: 3, seed: 42 },
    spec: SPEC,
    prompt: 'Обчисли ІМТ.\n\nВиправ програму.',
    code: 'w = input()\nprint(w)'
  });

  it('puts the header first, then the prompt as comments, then the code unchanged', () => {
    const lines = file.split('\n');
    expect(lines[0].startsWith('# ')).toBe(true);
    expect(file).toContain('# hilka-task: t-1\n# hilka-version: 3\n# hilka-seed: 42\n');
    expect(file).toContain('# Обчисли ІМТ.\n#\n# Виправ програму.\n');
    expect(file.endsWith('\n\nw = input()\nprint(w)\n')).toBe(true);
  });

  it('round-trips through parseHeader', () => {
    expect(parseHeader(file)).toEqual({ status: 'ok', header: { taskId: 't-1', version: 3, seed: 42 } });
  });

  it('omits the header when the spec says so', () => {
    const plain = generateStarterFile({
      header: { taskId: 't-1', version: 3 },
      spec: { ...SPEC, headerComment: false },
      prompt: 'P',
      code: 'x = 1\n'
    });
    expect(plain).toBe('# P\n\nx = 1\n');
    expect(parseHeader(plain)).toEqual({ status: 'missing' });
  });

  it('omits the seed line when there is no seed', () => {
    const noSeed = generateStarterFile({ header: { taskId: 't-1', version: 1 }, spec: SPEC, prompt: 'P', code: '' });
    expect(noSeed).not.toContain('hilka-seed');
    expect(parseHeader(noSeed)).toEqual({ status: 'ok', header: { taskId: 't-1', version: 1 } });
  });
});

describe('parseHeader', () => {
  it('reports an edited version as altered, not missing', () => {
    expect(parseHeader('# hilka-task: t-1\n# hilka-version: three\n')).toEqual({ status: 'altered' });
  });

  it('reports a deleted task line as altered', () => {
    expect(parseHeader('# hilka-version: 3\nprint(1)\n')).toEqual({ status: 'altered' });
  });

  it('ignores header-looking lines after the code starts', () => {
    expect(parseHeader('print(1)\n# hilka-task: t-1\n# hilka-version: 3\n')).toEqual({ status: 'missing' });
  });
});

describe('validateUpload', () => {
  it('accepts a clean UTF-8 file with no warnings', () => {
    const result = validateUpload('bmi_fix.py', utf8('print("Привіт")\n'), SPEC);
    expect(result).toEqual({ ok: true, source: 'print("Привіт")\n', warnings: [], header: { status: 'missing' } });
  });

  it('rejects a non-.py extension first', () => {
    expect(validateUpload('bmi_fix.txt', utf8('print(1)'), SPEC)).toEqual({ ok: false, rejection: 'extension' });
  });

  it('accepts an upper-case .PY extension', () => {
    expect(validateUpload('BMI_FIX.PY', utf8('print(1)'), SPEC).ok).toBe(true);
  });

  it('rejects a .docx renamed to .py as binary', () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(validateUpload('bmi_fix.py', zip, SPEC)).toEqual({ ok: false, rejection: 'binary' });
  });

  it('rejects content with NUL bytes as binary', () => {
    expect(validateUpload('bmi_fix.py', new Uint8Array([0x70, 0x00, 0x71]), SPEC)).toEqual({
      ok: false,
      rejection: 'binary'
    });
  });

  it('falls back to cp1251 with a warning', () => {
    // "Привіт" in Windows-1251 — invalid as UTF-8.
    const cp1251 = new Uint8Array([0x70, 0x3d, 0x22, 0xcf, 0xf0, 0xe8, 0xe2, 0xb3, 0xf2, 0x22, 0x0a]);
    const result = validateUpload('bmi_fix.py', cp1251, SPEC);
    expect(result).toEqual({ ok: true, source: 'p="Привіт"\n', warnings: ['cp1251'], header: { status: 'missing' } });
  });

  it('strips a BOM and normalizes CRLF without shifting lines', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('# коментар\r\nx = 1\r\nprint(x)\r\n')]);
    const result = validateUpload('bmi_fix.py', bytes, SPEC);
    expect(result.ok && result.source).toBe('# коментар\nx = 1\nprint(x)\n');
  });

  it('counts size after normalization', () => {
    const spec = { ...SPEC, maxBytes: 4 };
    expect(validateUpload('bmi_fix.py', utf8('a\r\nb\r\n'), spec).ok).toBe(true);
    expect(validateUpload('bmi_fix.py', utf8('abcde'), spec)).toEqual({ ok: false, rejection: 'too_large' });
  });

  it('warns, never rejects, on a different filename', () => {
    const result = validateUpload('bmi_fix (1).py', utf8('print(1)'), SPEC);
    expect(result.ok && result.warnings).toEqual(['filename']);
  });

  it('parses the header of an uploaded starter file', () => {
    const starter = generateStarterFile({ header: { taskId: 'abc', version: 2 }, spec: SPEC, prompt: 'P', code: 'x = 1' });
    const result = validateUpload('bmi_fix.py', utf8(starter.replace(/\n/g, '\r\n')), SPEC);
    expect(result.ok && result.header).toEqual({ status: 'ok', header: { taskId: 'abc', version: 2 } });
  });
});
