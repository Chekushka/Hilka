/**
 * The authoring UI's file-delivery control (docs/TASK_SCHEMA.md, "File
 * Delivery"): form state ⇄ the `delivery`/`file` payload fields. Pure, so the
 * three forms that carry it (NewTaskForm, DraftTaskEditor, FixDraftEditor)
 * share one mapping and one validation.
 *
 * The size cap is edited in KB because that is what a teacher can reason
 * about; the payload keeps bytes.
 */
import type { Delivery, FileSpec } from './types';

export interface DeliveryFormState {
  enabled: boolean;
  filename: string;
  headerComment: boolean;
  maxKb: number;
}

/** TASK_SCHEMA.md's default cap, 65536 bytes. */
export const DEFAULT_MAX_KB = 64;

export type DeliveryFormError = 'filename' | 'maxKb';

/** Anything a student's OS would refuse to save, or that reads as a path. */
const FILENAME = /^[^\\/:*?"<>|\u0000-\u001f]+\.py$/i;

export function deliveryFormFromPayload(
  payload: { delivery?: Delivery; file?: FileSpec },
  fallbackFilename = 'program.py'
): DeliveryFormState {
  if (payload.delivery === 'file' && payload.file) {
    return {
      enabled: true,
      filename: payload.file.filename,
      headerComment: payload.file.headerComment,
      maxKb: Math.max(1, Math.round(payload.file.maxBytes / 1024))
    };
  }
  return { enabled: false, filename: fallbackFilename, headerComment: true, maxKb: DEFAULT_MAX_KB };
}

export function validateDeliveryForm(state: DeliveryFormState): DeliveryFormError | null {
  if (!state.enabled) return null;
  if (!FILENAME.test(state.filename.trim())) return 'filename';
  if (!Number.isInteger(state.maxKb) || state.maxKb < 1 || state.maxKb > 1024) return 'maxKb';
  return null;
}

/**
 * Fields to spread into a `code`/`fix` payload. Inline delivery is the
 * absence of the field (types.ts: "Absent means 'inline'"), so a task that
 * never used files keeps the payload it always had.
 */
export function deliveryPayloadFields(state: DeliveryFormState): { delivery?: 'file'; file?: FileSpec } {
  if (!state.enabled) return {};
  return {
    delivery: 'file',
    file: { filename: state.filename.trim(), headerComment: state.headerComment, maxBytes: state.maxKb * 1024 }
  };
}

/** A starting file name from the task slug: `bmi-calc` → `bmi_calc.py`. */
export function filenameFromSlug(slug: string): string {
  const base = slug.trim().replace(/-/g, '_');
  return base === '' ? 'program.py' : `${base}.py`;
}
