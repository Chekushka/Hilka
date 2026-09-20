/**
 * CSV export for a session's attempts (docs/TASKS.md, "CSV export"). Pure —
 * no DOM, no database — so the API route only has to hand it the rows
 * lib/db/attempts.ts already shapes for the dashboard table and write the
 * result out.
 */
import { t } from '@/lib/i18n';
import type { SessionAttemptRow } from '@/lib/db/attempts';

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function attemptsToCsv(rows: SessionAttemptRow[]): string {
  const header = [
    t('dashboard.columnStudent'),
    t('dashboard.columnTask'),
    t('dashboard.columnResult'),
    t('dashboard.columnHints'),
    t('dashboard.columnDurationSeconds'),
    t('dashboard.columnSubmittedAt')
  ];

  const lines = [
    header,
    ...rows.map((row) => [
      row.studentName,
      row.taskTitle,
      row.passed ? t('dashboard.resultPassed') : t('dashboard.resultNotYet'),
      String(row.hintsUsed),
      row.durationMs !== null ? String(Math.round(row.durationMs / 1000)) : '',
      row.createdAt
    ])
  ];

  // \r\n per the CSV spec; Excel opens this fine, LibreOffice too. A UTF-8
  // BOM up front is what actually makes Excel read Cyrillic without asking —
  // the sole reason this constant exists rather than joining lines directly.
  const BOM = '﻿';
  return BOM + lines.map((line) => line.map(escapeCsvField).join(',')).join('\r\n');
}
