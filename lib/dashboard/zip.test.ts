import { describe, expect, it } from 'vitest';
import { crc32, createZip } from './zip';

/** Reads the archive back through its central directory, the way an unzip tool does. */
function readZip(bytes: Uint8Array): { name: string; flags: number; data: string }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endAt = bytes.length - 22;
  expect(view.getUint32(endAt, true)).toBe(0x06054b50);
  const count = view.getUint16(endAt + 10, true);
  let at = view.getUint32(endAt + 16, true);
  const decoder = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const flags = view.getUint16(at + 8, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(localAt, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(localAt + 26, true);
    const dataAt = localAt + 30 + localNameLength;
    const data = bytes.subarray(dataAt, dataAt + size);
    expect(crc32(data)).toBe(crc);
    out.push({ name, flags, data: decoder.decode(data) });
    at += 46 + nameLength;
  }
  return out;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('createZip', () => {
  it('round-trips entries with Cyrillic names, flagged as UTF-8', () => {
    const encoder = new TextEncoder();
    const zip = createZip([
      { name: 'Привіт/Олена.py', data: encoder.encode('print("Привіт")\n') },
      { name: 'Привіт/Тарас.py', data: encoder.encode('') }
    ]);
    const entries = readZip(zip);
    expect(entries.map((e) => [e.name, e.data])).toEqual([
      ['Привіт/Олена.py', 'print("Привіт")\n'],
      ['Привіт/Тарас.py', '']
    ]);
    expect(entries.every((e) => (e.flags & 0x0800) !== 0)).toBe(true);
  });

  it('produces a valid empty archive', () => {
    expect(readZip(createZip([]))).toEqual([]);
  });
});
