'use client';

/**
 * The visual builder for run cases (docs/TASK_SCHEMA.md, "Run cases"): one
 * card per case — label, stdin one line per `input()`, hidden, and the checks
 * that apply to that case alone (a nested ChecksField, which never offers
 * stdout_equals: a task with cases may not use it). Same contract as
 * ChecksField: the forms keep cases as JSON text, and JSON mode edits it raw.
 */
import { useState } from 'react';
import { ChecksField, ModeSwitch, RowButton } from '@/components/authoring/ChecksField';
import { DraftInput } from '@/components/authoring/DraftInput';
import { parseCasesJson, parseChecksJson } from '@/components/authoring/task-form-utils';
import { checksToJson, moveItem, normalizeCase, stdinFromText, type CheckKind } from '@/lib/task/check-form';
import type { RunCase } from '@/lib/task/types';
import { t } from '@/lib/i18n';

interface CasesFieldProps {
  id: string;
  value: string;
  onChange: (text: string) => void;
  kinds: readonly CheckKind[];
  error?: string | null;
}

function casesToJson(cases: readonly RunCase[]): string {
  return JSON.stringify(cases.map(normalizeCase), null, 2);
}

export function CasesField({ id, value, onChange, kinds, error }: CasesFieldProps) {
  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const parsed = parseCasesJson(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm text-ink-muted">
          {t('authoring.casesLabel')}
        </span>
        <ModeSwitch id={id} mode={mode} setMode={setMode} />
      </div>
      {mode === 'json' || !parsed.ok ? (
        <>
          <textarea
            id={id}
            aria-label={t('authoring.casesJsonLabel')}
            rows={4}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
          />
          {mode === 'builder' && !parsed.ok && (
            <p className="text-xs text-attention">{t('builder.jsonInvalidForBuilder')}</p>
          )}
          <p className="text-xs text-ink-muted">{t('authoring.casesHint')}</p>
        </>
      ) : (
        <div id={id} role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
          {parsed.cases.length === 0 && <p className="text-sm text-ink-muted">{t('builder.casesEmpty')}</p>}
          {parsed.cases.map((runCase, index) => (
            <CaseCard
              key={index}
              idPrefix={`${id}-${index}`}
              index={index}
              count={parsed.cases.length}
              runCase={runCase}
              kinds={kinds}
              onChange={(next) =>
                onChange(casesToJson(parsed.cases.map((existing, at) => (at === index ? next : existing))))
              }
              onMove={(to) => onChange(casesToJson(moveItem(parsed.cases, index, to)))}
              onRemove={() => onChange(casesToJson(parsed.cases.filter((_, at) => at !== index)))}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange(casesToJson([...parsed.cases, { stdin: [] }]))}
            className="self-start rounded-md border border-accent px-3 py-1.5 text-sm text-accent"
          >
            {t('builder.addCase')}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-attention">{error}</p>}
    </div>
  );
}

function CaseCard({
  idPrefix,
  index,
  count,
  runCase,
  kinds,
  onChange,
  onMove,
  onRemove
}: {
  idPrefix: string;
  index: number;
  count: number;
  runCase: RunCase;
  kinds: readonly CheckKind[];
  onChange: (runCase: RunCase) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const heading = t('builder.caseNumber', { n: index + 1 });
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2.5">
      <legend className="sr-only">{heading}</legend>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink">{heading}</span>
        <span className="ml-auto flex gap-1 text-xs">
          <RowButton label={t('builder.moveUp')} disabled={index === 0} onClick={() => onMove(index - 1)}>
            ↑
          </RowButton>
          <RowButton label={t('builder.moveDown')} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            ↓
          </RowButton>
          <RowButton label={t('builder.remove')} onClick={onRemove}>
            ✕
          </RowButton>
        </span>
      </div>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t('builder.caseLabel')}
          <input
            value={runCase.label ?? ''}
            onChange={(event) => onChange({ ...runCase, label: event.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-stdin`} className="text-xs text-ink-muted">
            {t('builder.caseStdin')}
          </label>
          <DraftInput
            id={`${idPrefix}-stdin`}
            text={runCase.stdin.join('\n')}
            multiline
            rows={Math.max(2, runCase.stdin.length)}
            mono
            commit={(draft) => {
              const stdin = stdinFromText(draft);
              onChange({ ...runCase, stdin });
              // What the parent will hand back — so a trailing Enter stays in the draft instead of being reset away.
              return stdin.join('\n');
            }}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={runCase.hidden === true}
          onChange={(event) => onChange({ ...runCase, hidden: event.target.checked })}
        />
        {t('builder.caseHidden')}
      </label>
      <ChecksField
        id={`${idPrefix}-checks`}
        nested
        value={checksToJson(runCase.checks ?? [])}
        onChange={(text) => {
          const parsed = parseChecksJson(text);
          if (parsed.ok) onChange({ ...runCase, checks: parsed.checks });
        }}
        kinds={kinds}
        hasCases
        label={t('builder.caseChecks')}
        jsonLabel={t('builder.caseChecks')}
      />
    </fieldset>
  );
}
