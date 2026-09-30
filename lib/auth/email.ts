/**
 * One spelling per address: the sign-up form, the superuser's form and the
 * login form all store or look up the same lowercase, trimmed string, so an
 * address typed with capitals once still matches later.
 */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Enough to catch a typo, not an RFC 5322 parser: something@something.tld, no spaces, a sane length. */
export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
