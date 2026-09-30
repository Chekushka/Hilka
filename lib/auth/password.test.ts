import { describe, expect, it } from 'vitest';
import { hashPassword, parsePasswordHash, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  const stored = hashPassword('correct horse battery');

  it('verifies the right password and refuses a wrong one', () => {
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
    expect(verifyPassword('correct horse batterY', stored)).toBe(false);
  });

  it('salts: the same password hashes differently each time', () => {
    expect(hashPassword('correct horse battery')).not.toBe(stored);
  });

  it('holds no $, so it survives a shell or a settings form', () => {
    expect(stored).not.toContain('$');
    expect(stored.startsWith('scrypt:16384:8:1:')).toBe(true);
  });

  it('refuses a malformed or absurd stored value instead of throwing', () => {
    expect(verifyPassword('x', 'plain-text-password')).toBe(false);
    expect(verifyPassword('x', 'scrypt:16384:8:1:c2FsdA:aGFzaA')).toBe(false);
    expect(parsePasswordHash(stored.replace('scrypt:16384', 'scrypt:1073741824'))).toBeNull();
  });
});
