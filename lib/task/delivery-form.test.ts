import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_KB,
  deliveryFormFromPayload,
  deliveryPayloadFields,
  filenameFromSlug,
  validateDeliveryForm
} from './delivery-form';
import { isTaskPayload } from './payload-guards';

const enabled = { enabled: true, filename: 'bmi.py', headerComment: true, maxKb: 64 };

describe('deliveryFormFromPayload', () => {
  it('reads an existing file spec back, bytes as KB', () => {
    expect(
      deliveryFormFromPayload({ delivery: 'file', file: { filename: 'bmi.py', headerComment: false, maxBytes: 65536 } })
    ).toEqual({ enabled: true, filename: 'bmi.py', headerComment: false, maxKb: 64 });
  });

  it('defaults an inline task to disabled with the fallback name and the schema default cap', () => {
    expect(deliveryFormFromPayload({}, 'x.py')).toEqual({
      enabled: false,
      filename: 'x.py',
      headerComment: true,
      maxKb: DEFAULT_MAX_KB
    });
  });
});

describe('deliveryPayloadFields', () => {
  it('adds nothing for inline delivery, so an inline payload is unchanged', () => {
    expect(deliveryPayloadFields({ ...enabled, enabled: false })).toEqual({});
  });

  it('round-trips through deliveryFormFromPayload', () => {
    expect(deliveryFormFromPayload(deliveryPayloadFields(enabled))).toEqual(enabled);
  });

  it('produces a payload the authoring API accepts', () => {
    const payload = { type: 'code', surface: 'console', prompt: 'p', starter: '', ...deliveryPayloadFields(enabled) };
    expect(isTaskPayload(payload)).toBe(true);
  });

  it('trims the file name', () => {
    expect(deliveryPayloadFields({ ...enabled, filename: '  bmi.py ' }).file?.filename).toBe('bmi.py');
  });
});

describe('validateDeliveryForm', () => {
  it('accepts a well-formed spec and ignores fields while disabled', () => {
    expect(validateDeliveryForm(enabled)).toBeNull();
    expect(validateDeliveryForm({ ...enabled, enabled: false, filename: '' })).toBeNull();
  });

  it('requires a .py name that is not a path', () => {
    expect(validateDeliveryForm({ ...enabled, filename: 'bmi.txt' })).toBe('filename');
    expect(validateDeliveryForm({ ...enabled, filename: '.py' })).toBe('filename');
    expect(validateDeliveryForm({ ...enabled, filename: '../bmi.py' })).toBe('filename');
    expect(validateDeliveryForm({ ...enabled, filename: 'програма.py' })).toBeNull();
  });

  it('requires a whole, sane KB cap', () => {
    expect(validateDeliveryForm({ ...enabled, maxKb: 0 })).toBe('maxKb');
    expect(validateDeliveryForm({ ...enabled, maxKb: 1.5 })).toBe('maxKb');
    expect(validateDeliveryForm({ ...enabled, maxKb: Number.NaN })).toBe('maxKb');
    expect(validateDeliveryForm({ ...enabled, maxKb: 2048 })).toBe('maxKb');
  });
});

describe('filenameFromSlug', () => {
  it('turns a slug into a Python-friendly file name', () => {
    expect(filenameFromSlug('g8-bmi-calc')).toBe('g8_bmi_calc.py');
    expect(filenameFromSlug('')).toBe('program.py');
  });
});
