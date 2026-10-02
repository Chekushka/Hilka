'use client';

/**
 * The visual check builder (docs/TASKS.md, "Task authoring UI"). The forms
 * keep checks as JSON text, exactly as before; this field edits that text
 * through a form per check kind (lib/task/check-form.ts) or, in JSON mode, as
 * the raw textarea it replaces. Either way what is saved is the same data a
 * teacher could type by hand — checks are data, never code (CLAUDE.md rule 1).
 */
import { useState } from 'react';
import { DraftInput } from '@/components/authoring/DraftInput';
import { parseChecksJson } from '@/components/authoring/task-form-utils';
import type { Check } from '@/lib/checker';
import {
  applyField,
  applyMessage,
  blockedKind,
  changeKind,
  CHECK_FIELDS,
  checksToJson,
  defaultCheck,
  fieldText,
  moveItem,
  unsupportedKeys,
  type CheckKind,
  type FieldSpec
} from '@/lib/task/check-form';
import { t } from '@/lib/i18n';

interface ChecksFieldProps {
  id: string;
  value: string;
  onChange: (text: string) => void;
  kinds: readonly CheckKind[];
  /** A task with cases may not use stdout_equals (docs/TASK_SCHEMA.md). */
  hasCases: boolean;
  label: string;
  jsonLabel: string;
  jsonHint?: string;
  error?: string | null;
  /** Inside a case: no own mode switch, a lighter frame. */
  nested?: boolean;
}

export function ChecksField({
  id,
  value,
  onChange,
  kinds,
  hasCases,
  label,
  jsonLabel,
  jsonHint,
  error,
  nested = false
}: ChecksFieldProps) {
  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const parsed = parseChecksJson(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm text-ink-muted">
          {label}
        </span>
        {!nested && <ModeSwitch id={id} mode={mode} setMode={setMode} />}
      </div>
      {mode === 'json' || !parsed.ok ? (
        <>
          <textarea
            id={id}
            aria-label={jsonLabel}
            rows={6}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            className="rounded-md border border-line bg-code-bg px-3 py-2 font-mono text-sm text-ink"
          />
          {mode === 'builder' && !parsed.ok && (
            <p className="text-xs text-attention">{t('builder.jsonInvalidForBuilder')}</p>
          )}
          {jsonHint && <p className="text-xs text-ink-muted">{jsonHint}</p>}
        </>
      ) : (
        <CheckList
          id={id}
          checks={parsed.checks}
          onChange={(checks) => onChange(checksToJson(checks))}
          kinds={kinds}
          hasCases={hasCases}
          nested={nested}
        />
      )}
      {error && <p className="text-xs text-attention">{error}</p>}
    </div>
  );
}

export function ModeSwitch({
  id,
  mode,
  setMode
}: {
  id: string;
  mode: 'builder' | 'json';
  setMode: (mode: 'builder' | 'json') => void;
}) {
  return (
    <div role="group" aria-label={t('builder.modeLabel')} className="flex gap-1 text-xs">
      {(['builder', 'json'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={mode === option}
          aria-controls={id}
          onClick={() => setMode(option)}
          className={`rounded-full border px-2.5 py-0.5 ${
            mode === option ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-muted'
          }`}
        >
          {option === 'builder' ? t('builder.modeBuilder') : t('builder.modeJson')}
        </button>
      ))}
    </div>
  );
}

function CheckList({
  id,
  checks,
  onChange,
  kinds,
  hasCases,
  nested
}: {
  id: string;
  checks: Check[];
  onChange: (checks: Check[]) => void;
  kinds: readonly CheckKind[];
  hasCases: boolean;
  nested: boolean;
}) {
  const available = kinds.filter((kind) => blockedKind(kind, { hasCases }) === null);
  const [newKind, setNewKind] = useState<CheckKind>(available[0] ?? kinds[0]);
  const addKind = available.includes(newKind) ? newKind : available[0];
  const blocked = kinds.filter((kind) => blockedKind(kind, { hasCases }) !== null);

  return (
    <div id={id} role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      {checks.length === 0 && !nested && <p className="text-sm text-ink-muted">{t('builder.empty')}</p>}
      {checks.map((check, index) => (
        <CheckRow
          // The kind is part of the key: switching kind starts the row's fields afresh.
          key={`${index}-${check.kind}`}
          idPrefix={`${id}-${index}`}
          index={index}
          count={checks.length}
          check={check}
          kinds={kinds}
          hasCases={hasCases}
          onChange={(next) => onChange(checks.map((existing, at) => (at === index ? next : existing)))}
          onMove={(to) => onChange(moveItem(checks, index, to))}
          onRemove={() => onChange(checks.filter((_, at) => at !== index))}
        />
      ))}
      {addKind && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t('builder.addCheckKind')}
            value={addKind}
            onChange={(event) => setNewKind(event.target.value as CheckKind)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          >
            {available.map((kind) => (
              <option key={kind} value={kind}>
                {t(`builder.kinds.${kind}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange([...checks, defaultCheck(addKind)])}
            className="rounded-md border border-accent px-3 py-1.5 text-sm text-accent"
          >
            {t('builder.addCheck')}
          </button>
        </div>
      )}
      {/* Once per task, not once per case — every case would repeat it. */}
      {blocked.length > 0 && !nested && <p className="text-xs text-ink-muted">{t('builder.stdoutWithCases')}</p>}
    </div>
  );
}

function CheckRow({
  idPrefix,
  index,
  count,
  check,
  kinds,
  hasCases,
  onChange,
  onMove,
  onRemove
}: {
  idPrefix: string;
  index: number;
  count: number;
  check: Check;
  kinds: readonly CheckKind[];
  hasCases: boolean;
  onChange: (check: Check) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const unsupported = unsupportedKeys(check);
  const kind = check.kind === 'grid_goal' ? null : check.kind;
  const blocked = kind ? blockedKind(kind, { hasCases }) : null;
  // A check of a kind this task type does not offer (an old import) still shows, with its own kind listed.
  const kindOptions = kind && !kinds.includes(kind) ? [...kinds, kind] : kinds;

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2.5">
      <legend className="sr-only">{t('builder.checkNumber', { n: index + 1 })}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-muted">{index + 1}.</span>
        {kind ? (
          <select
            id={`${idPrefix}-kind`}
            aria-label={t('builder.kindLabel')}
            value={kind}
            onChange={(event) => onChange(changeKind(check, event.target.value as CheckKind))}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium text-ink"
          >
            {kindOptions.map((option) => (
              <option key={option} value={option} disabled={blockedKind(option, { hasCases }) !== null && option !== kind}>
                {t(`builder.kinds.${option}`)}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-sm text-ink">{check.kind}</span>
        )}
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
      {blocked && <p className="text-xs text-attention">{t(`builder.${blocked}`)}</p>}
      {unsupported.length > 0 || !kind ? (
        <RawCheck check={check} keys={unsupported} onChange={onChange} idPrefix={idPrefix} />
      ) : (
        <>
          {(kind === 'shape_equals' || kind === 'shape_contains') && (
            <p className="text-xs text-ink-muted">{t('builder.referenceNote')}</p>
          )}
          {kind === 'matches_reference' && (
            <p className="text-xs text-ink-muted">{t('builder.matchesReferenceNote')}</p>
          )}
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {CHECK_FIELDS[kind].map((field) => (
              <CheckFieldControl
                key={field.key}
                id={`${idPrefix}-${field.key}`}
                check={check}
                field={field}
                onChange={onChange}
              />
            ))}
          </div>
        </>
      )}
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('builder.messageLabel')}
        <input
          value={check.message ?? ''}
          onChange={(event) => onChange(applyMessage(check, event.target.value))}
          placeholder={t('builder.messagePlaceholder')}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        />
      </label>
    </fieldset>
  );
}

export function RowButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-line px-2 py-0.5 text-ink-muted hover:border-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function RawCheck({
  check,
  keys,
  onChange,
  idPrefix
}: {
  check: Check;
  keys: string[];
  onChange: (check: Check) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-ink-muted">{t('builder.rawOnly', { keys: keys.join(', ') })}</p>
      <DraftInput
        id={`${idPrefix}-raw`}
        text={JSON.stringify(check, null, 2)}
        multiline
        rows={5}
        mono
        invalidMessage={t('builder.rawInvalid')}
        commit={(draft) => {
          let value: unknown;
          try {
            value = JSON.parse(draft);
          } catch {
            return null;
          }
          if (typeof value !== 'object' || value === null || typeof (value as { kind?: unknown }).kind !== 'string') {
            return null;
          }
          onChange(value as Check);
          return JSON.stringify(value, null, 2);
        }}
      />
    </div>
  );
}

function CheckFieldControl({
  id,
  check,
  field,
  onChange
}: {
  id: string;
  check: Check;
  field: FieldSpec;
  onChange: (check: Check) => void;
}) {
  const label = t(`builder.fields.${field.key}`);
  const text = fieldText(check, field);
  const set = (next: string): string | null => {
    const result = applyField(check, field, next);
    if (!result.ok) return null;
    onChange(result.check);
    return fieldText(result.check, field);
  };
  const wide = field.type === 'multiline' || field.type === 'code' || field.type === 'normalizeSet';

  if (field.type === 'bool') {
    return (
      <label className="flex items-center gap-2 self-end text-sm text-ink">
        <input id={id} type="checkbox" checked={text === 'true'} onChange={(event) => set(String(event.target.checked))} />
        {label}
      </label>
    );
  }

  if (field.type === 'normalizeSet') {
    const selected = new Set(text.split(',').filter(Boolean));
    return (
      <fieldset className="flex flex-col gap-1 sm:col-span-2">
        <legend className="text-xs text-ink-muted">{label}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(['translate', 'rotate', 'scale'] as const).map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.has(option)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option);
                  else next.delete(option);
                  set([...next].join(','));
                }}
              />
              {t(`builder.normalizeOptions.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  let control: React.ReactNode;
  if (field.type === 'select' || field.type === 'triBool') {
    const options =
      field.type === 'triBool'
        ? [
            ['', t('builder.either')],
            ['true', t('builder.yes')],
            ['false', t('builder.no')]
          ]
        : [
            // A required select has no "none": the check would be missing a key it needs.
            ...(field.required ? [] : [['', t('builder.none')]]),
            ...(field.options ?? []).map((option) => [option, t(`builder.normalizeText.${option}`)])
          ];
    control = (
      <select
        id={id}
        value={text}
        onChange={(event) => set(event.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
      >
        {options.map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'which') {
    const mode = text === '' || text === 'last' ? 'last' : text === 'first' ? 'first' : 'index';
    control = (
      <span className="flex gap-2">
        <select
          id={id}
          value={mode}
          onChange={(event) => set(event.target.value === 'index' ? '0' : event.target.value)}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="last">{t('builder.whichLast')}</option>
          <option value="first">{t('builder.whichFirst')}</option>
          <option value="index">{t('builder.whichIndex')}</option>
        </select>
        {mode === 'index' && (
          <DraftInput
            text={text}
            commit={set}
            className="w-20"
            ariaLabel={t('builder.whichIndex')}
            invalidMessage={t('builder.notParsed')}
          />
        )}
      </span>
    );
  } else {
    control = (
      <DraftInput
        id={id}
        text={text}
        commit={set}
        multiline={field.type === 'multiline' || field.type === 'code'}
        rows={field.type === 'code' ? 2 : 3}
        mono={field.type === 'code' || field.type === 'multiline'}
        invalidMessage={t('builder.notParsed')}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      {control}
      {field.type === 'json' && <span className="text-xs text-ink-muted">{t('builder.valueJsonHint')}</span>}
    </div>
  );
}
