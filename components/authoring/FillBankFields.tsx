'use client';

import { t } from '@/lib/i18n';
import { MAX_BANK_CARDS, fillFromBank, fillTemplateGaps, isFillBankValid } from '@/lib/task/fill';

/** One card per line, blank lines and edge spaces dropped. */
export function parseBankText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * A `fill` task's word bank (docs/TASK_SCHEMA.md, `fill`): a switch, then the
 * cards one per line. With a reference written, says at once whether the cards
 * can build it — the same rule the publish route enforces (`fillFromBank`).
 */
export function FillBankFields({
  on,
  onToggle,
  text,
  onTextChange,
  template,
  referenceCode
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  text: string;
  onTextChange: (text: string) => void;
  template: string;
  /** The reference as written so far; absent where the form has none yet. */
  referenceCode?: string;
}) {
  const cards = parseBankText(text);
  const gaps = fillTemplateGaps(template).length;
  const count = cards.length;
  const shapeOk = isFillBankValid(template, cards);
  const builds = shapeOk && referenceCode && referenceCode.trim() !== '' ? fillFromBank(template, cards, referenceCode) : undefined;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={on} onChange={(event) => onToggle(event.target.checked)} data-testid="fill-bank-toggle" />
        {t('authoring.fillBankLabel')}
      </label>
      {on && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink-muted" htmlFor="fill-bank">
            {t('authoring.fillBankCardsLabel')}
          </label>
          <textarea
            id="fill-bank"
            rows={5}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            spellCheck={false}
            className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
          />
          <p className="text-xs text-ink-muted">{t('authoring.fillBankHint', { max: MAX_BANK_CARDS })}</p>
          {!shapeOk && count > 0 && (
            <p className="text-sm text-attention">{t('authoring.fillBankShape', { gaps, max: MAX_BANK_CARDS })}</p>
          )}
          {builds === null && <p className="text-sm text-attention" data-testid="fill-bank-mismatch">{t('authoring.fillBankMismatch')}</p>}
          {builds && <p className="text-sm text-growth" data-testid="fill-bank-ok">{t('authoring.fillBankOk')}</p>}
        </div>
      )}
    </div>
  );
}
