/**
 * Per-session bulk download of submitted files (docs/TASKS.md, "File
 * Delivery"). A teacher reviewing a file-delivery task needs the files
 * themselves, not only pass/fail.
 *
 * One file per student per task: the latest upload, since that is what the
 * student last handed in — a later failing upload after a pass is still the
 * student's own last word, and the dashboard's attempts log keeps the rest.
 * Laid out as `<task title>/<student name>.py`.
 *
 * Pure — no DOM, no database — same split as rollup.ts and csv.ts.
 */
import type { ZipEntry } from './zip';

export interface FileSubmissionRow {
  studentName: string;
  taskId: string;
  taskTitle: string;
  code: string;
  createdAt: string;
}

/** Strips what Windows, macOS or a zip tool would reject or read as a path. */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 100);
  return cleaned === '' ? '_' : cleaned;
}

export function latestSubmissionFiles(rows: FileSubmissionRow[]): ZipEntry[] {
  const latest = new Map<string, FileSubmissionRow>();
  for (const row of rows) {
    const key = `${row.taskId}\u0000${row.studentName}`;
    const current = latest.get(key);
    if (!current || row.createdAt > current.createdAt) {
      latest.set(key, row);
    }
  }

  const encoder = new TextEncoder();
  const entries = [...latest.values()]
    .map((row) => ({
      name: `${safeFileName(row.taskTitle)}/${safeFileName(row.studentName)}.py`,
      data: encoder.encode(row.code)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  // Two tasks sharing a title, or two names that differ only in stripped
  // characters, would otherwise overwrite each other on extraction.
  const used = new Set<string>();
  return entries.map((entry) => {
    let name = entry.name;
    for (let n = 2; used.has(name); n++) {
      name = entry.name.replace(/\.py$/, ` (${n}).py`);
    }
    used.add(name);
    return { ...entry, name };
  });
}
