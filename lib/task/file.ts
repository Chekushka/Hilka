/**
 * File delivery (docs/TASK_SCHEMA.md, "File Delivery"): the starter file a
 * student downloads, and the validation an uploaded file passes before any of
 * it runs. Pure — no DOM, no Python — so it can move server-side unchanged
 * when the v2 CPython path arrives.
 *
 * Upload validation implements steps 1–8 of TASK_SCHEMA.md's table, in its
 * order. Step 9 (the safe-subset linter) is not built yet; a file that passes
 * here goes straight to the same runner and checks an inline task uses.
 */
import { t } from '@/lib/i18n';
import type { FileSpec } from './types';

/** The triple that already identifies an attempt, carried in the file itself. */
export interface FileHeader {
  taskId: string;
  version: number;
  /** Absent outside a parameterized session task — the browser never learns it there either. */
  seed?: number;
}

const HEADER_KEYS = { taskId: 'hilka-task', version: 'hilka-version', seed: 'hilka-seed' } as const;

export function commentBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `# ${line}` : '#'))
    .join('\n');
}

/**
 * Header, prompt as comments, then the student's starting code unchanged —
 * TASK_SCHEMA.md, "Starter file generation". Always `\n` line endings and no
 * BOM; IDLE opens that as-is.
 */
export function generateStarterFile(input: {
  header: FileHeader;
  spec: FileSpec;
  prompt: string;
  code: string;
}): string {
  const parts: string[] = [];
  if (input.spec.headerComment) {
    const lines = [
      t('file.headerNotice'),
      `${HEADER_KEYS.taskId}: ${input.header.taskId}`,
      `${HEADER_KEYS.version}: ${input.header.version}`
    ];
    if (input.header.seed !== undefined) {
      lines.push(`${HEADER_KEYS.seed}: ${input.header.seed}`);
    }
    parts.push(commentBlock(lines.join('\n')));
  }
  parts.push(commentBlock(input.prompt.trim()));
  const code = input.code.endsWith('\n') ? input.code : `${input.code}\n`;
  return `${parts.join('\n\n')}\n\n${code}`;
}

export type HeaderParse =
  | { status: 'ok'; header: FileHeader }
  /** No header lines at all — a copy-paste into a fresh file, most likely. */
  | { status: 'missing' }
  /** Some header lines present but unparseable — edited, innocently or not. */
  | { status: 'altered' };

const HEADER_LINE = /^#\s*(hilka-task|hilka-version|hilka-seed)\s*:\s*(.*?)\s*$/;

/** Step 8. Reads only the leading comment block, so a matching line inside the student's own code is ignored. */
export function parseHeader(source: string): HeaderParse {
  const found = new Map<string, string>();
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !trimmed.startsWith('#')) break;
    const match = HEADER_LINE.exec(trimmed);
    if (match) {
      if (found.has(match[1])) return { status: 'altered' };
      found.set(match[1], match[2]);
    }
  }
  if (found.size === 0) return { status: 'missing' };

  const taskId = found.get(HEADER_KEYS.taskId);
  const version = found.get(HEADER_KEYS.version);
  const seed = found.get(HEADER_KEYS.seed);
  if (!taskId || !version || !/^\d+$/.test(version)) return { status: 'altered' };
  if (seed !== undefined && !/^-?\d+$/.test(seed)) return { status: 'altered' };
  const header: FileHeader = { taskId, version: Number(version) };
  if (seed !== undefined) header.seed = Number(seed);
  return { status: 'ok', header };
}

export type UploadRejection = 'extension' | 'binary' | 'encoding' | 'too_large';
export type UploadWarning = 'cp1251' | 'filename';

export type UploadResult =
  | { ok: false; rejection: UploadRejection }
  | { ok: true; source: string; warnings: UploadWarning[]; header: HeaderParse };

/**
 * Signatures of the files most likely to be renamed to `.py` by accident:
 * zip (and so `.docx`), PDF, legacy OLE `.doc`, PNG, JPEG.
 */
const BINARY_SIGNATURES: number[][] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x25, 0x50, 0x44, 0x46],
  [0xd0, 0xcf, 0x11, 0xe0],
  [0x89, 0x50, 0x4e, 0x47],
  [0xff, 0xd8, 0xff]
];

function looksBinary(bytes: Uint8Array): boolean {
  if (BINARY_SIGNATURES.some((sig) => sig.every((b, i) => bytes[i] === b))) return true;
  // A NUL byte never appears in text IDLE saves, in either encoding.
  return bytes.includes(0);
}

function decode(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Steps 1–8 of TASK_SCHEMA.md's upload validation, first failing step wins.
 * `source` is what gets run and stored — normalized, but otherwise exactly
 * what the student wrote.
 */
export function validateUpload(filename: string, bytes: Uint8Array, spec: FileSpec): UploadResult {
  // 1. Extension.
  if (!/\.py$/i.test(filename)) return { ok: false, rejection: 'extension' };

  // 2. Binary content under a .py name.
  if (looksBinary(bytes)) return { ok: false, rejection: 'binary' };

  const warnings: UploadWarning[] = [];

  // 3. Encoding: UTF-8 (with or without BOM), else cp1251 with a warning.
  // TextDecoder strips a UTF-8 BOM by default — that is step 4.
  let text = decode(bytes, 'utf-8');
  if (text === null) {
    text = decode(bytes, 'windows-1251');
    if (text === null) return { ok: false, rejection: 'encoding' };
    warnings.push('cp1251');
  }

  // 4. A BOM that survived decoding (e.g. doubled) is still not the student's code.
  text = text.replace(/^﻿+/, '');

  // 5. CRLF, and a bare CR from an old Mac-style save, to \n.
  text = text.replace(/\r\n?/g, '\n');

  // 6. Size, counted on what the student actually wrote.
  if (new TextEncoder().encode(text).length > spec.maxBytes) return { ok: false, rejection: 'too_large' };

  // 7. Name is a convenience for the student's own folder, never graded.
  if (filename !== spec.filename) warnings.push('filename');

  // 8. Header — reported, never a rejection; the caller decides what a missing one means.
  return { ok: true, source: text, warnings, header: parseHeader(text) };
}
