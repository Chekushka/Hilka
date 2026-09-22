/**
 * Development surface for app/error.tsx. Not a product screen — a real
 * Neon outage is what this boundary actually exists for, and that is not
 * something a test can safely induce against the shared database other
 * specs run against. This page throws unconditionally instead, so the
 * boundary itself — the thing under test — is exercised deterministically.
 */
// Otherwise Next tries to prerender this at build time, where an
// unconditional throw fails the build itself rather than exercising the
// boundary at request time.
export const dynamic = 'force-dynamic';

export default function ErrorBoundaryDevPage(): never {
  throw new Error('deliberate failure for testing app/error.tsx');
}
