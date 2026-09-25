'use client';

/**
 * The file-delivery control for `code` and `fix` tasks (docs/TASK_SCHEMA.md,
 * "File Delivery"): whether the student works in IDLE and returns a `.py`
 * file, and the file's name, header and size cap. Controlled — the owning
 * form keeps the state and maps it with lib/task/delivery-form.ts.
 */
import { t } from '@/lib/i18n';
import type { DeliveryFormState } from '@/lib/task/delivery-form';

interface FileDeliveryFieldsProps {
  value: DeliveryFormState;
  onChange: (next: DeliveryFormState) => void;
}

export function FileDeliveryFields({ value, onChange }: FileDeliveryFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-line p-4">
      <legend className="px-1 text-sm text-ink-muted">{t('authoring.deliveryLegend')}</legend>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        {t('authoring.deliveryFileLabel')}
      </label>
      <p className="text-xs text-ink-muted">{t('authoring.deliveryFileHint')}</p>

      {value.enabled && (
        <>
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-ink-muted" htmlFor="deliveryFilename">
                {t('authoring.deliveryFilenameLabel')}
              </label>
              <input
                id="deliveryFilename"
                value={value.filename}
                onChange={(event) => onChange({ ...value, filename: event.target.value })}
                spellCheck={false}
                className="w-56 rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-ink-muted" htmlFor="deliveryMaxKb">
                {t('authoring.deliveryMaxKbLabel')}
              </label>
              <input
                id="deliveryMaxKb"
                type="number"
                min={1}
                max={1024}
                value={Number.isNaN(value.maxKb) ? '' : value.maxKb}
                onChange={(event) => onChange({ ...value, maxKb: event.target.valueAsNumber })}
                className="w-28 rounded-md border border-line bg-surface px-3 py-2 text-ink"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={value.headerComment}
              onChange={(event) => onChange({ ...value, headerComment: event.target.checked })}
            />
            {t('authoring.deliveryHeaderLabel')}
          </label>
          <p className="text-xs text-ink-muted">{t('authoring.deliveryLintNote')}</p>
        </>
      )}
    </fieldset>
  );
}
