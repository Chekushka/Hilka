/**
 * The per-browser device mark (docs/HOMEWORK.md, section 2, option D): a
 * random id in a long-lived cookie, written onto every attempt so the teacher
 * can see how many devices worked under one roster name. Not signed and not a
 * fingerprint — it identifies a browser, never a person, and forging one gains
 * nothing: it only decides which device an attempt is shown under.
 *
 * Route handlers only (it reads and writes the request's cookies).
 */
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

export const DEVICE_COOKIE_NAME = 'hilka_device';
const ONE_YEAR_S = 365 * 24 * 60 * 60;
const SHAPE = /^[0-9a-f-]{36}$/;

/** This browser's device id, minting and setting one on first use. */
export async function deviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE_NAME)?.value;
  if (existing && SHAPE.test(existing)) return existing;
  const id = randomUUID();
  store.set(DEVICE_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_S
  });
  return id;
}
