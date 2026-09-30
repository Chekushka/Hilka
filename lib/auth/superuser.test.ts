import { describe, expect, it } from 'vitest';
import { hashPassword } from './password';
import { checkSuperuserCredentials, superuserConfig, superuserEmail } from './superuser';

const passwordHash = hashPassword('a long enough password');

describe('superuserConfig', () => {
  it('needs both variables, and a well-formed hash', () => {
    expect(superuserConfig({ SUPERUSER_LOGIN: 'admin', SUPERUSER_PASSWORD_HASH: passwordHash })).toEqual({
      login: 'admin',
      passwordHash
    });
    expect(superuserConfig({ SUPERUSER_LOGIN: 'admin' })).toBeNull();
    expect(superuserConfig({ SUPERUSER_PASSWORD_HASH: passwordHash })).toBeNull();
    expect(superuserConfig({ SUPERUSER_LOGIN: 'admin', SUPERUSER_PASSWORD_HASH: 'a long enough password' })).toBeNull();
  });
});

describe('checkSuperuserCredentials', () => {
  const config = { login: 'admin', passwordHash };

  it('accepts the login and password together, and only together', () => {
    expect(checkSuperuserCredentials('admin', 'a long enough password', config)).toBe(true);
    expect(checkSuperuserCredentials('Admin', 'a long enough password', config)).toBe(false);
    expect(checkSuperuserCredentials('admin', 'a wrong password', config)).toBe(false);
  });

  it('ignores spaces around the login, as typed on a phone', () => {
    expect(checkSuperuserCredentials(' admin ', 'a long enough password', config)).toBe(true);
  });
});

describe('superuserEmail', () => {
  it('normalizes the address, and is null when unset or not an address', () => {
    expect(superuserEmail({ SUPERUSER_EMAIL: ' Admin@School.UA ' })).toBe('admin@school.ua');
    expect(superuserEmail({})).toBeNull();
    expect(superuserEmail({ SUPERUSER_EMAIL: 'admin' })).toBeNull();
  });
});
