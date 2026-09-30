/**
 * Password hashing for the one password in the system — the superuser's
 * (lib/auth/superuser.ts). scrypt from node:crypto, no dependency. The
 * stored form is `scrypt:N:r:p:salt:hash` with base64url parts, so it holds
 * no `$` and survives being pasted into a shell or Vercel's settings.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join(':');
}

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

export function parsePasswordHash(stored: string): ParsedHash | null {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((value) => Number.isInteger(value) && value > 0)) return null;
  // Guards a hand-edited value from asking scrypt for gigabytes of memory.
  if (n > 2 ** 20 || r > 32 || p > 16) return null;
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  if (salt.length < 8 || hash.length < 16) return null;
  return { n, r, p, salt, hash };
}

/** Constant-time on the hash comparison; false for a malformed stored value. */
export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  const actual = scryptSync(password, parsed.salt, parsed.hash.length, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
    maxmem: 256 * parsed.n * parsed.r + 1024 * 1024
  });
  return timingSafeEqual(actual, parsed.hash);
}
