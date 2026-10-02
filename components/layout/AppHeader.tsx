/**
 * The app bar every screen shares (docs/mockups): the mark and wordmark on the
 * left, linking home, then whatever the route group puts beside it, and the
 * light/dark switch on every screen. Quiet on purpose — no shadow, one
 * hairline, the same surface as the task panel.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLockup } from '@/components/brand/BrandMark';
import { ThemeToggle } from './ThemeToggle';
import { t } from '@/lib/i18n';

interface AppHeaderProps {
  /** Links next to the wordmark, after a divider. */
  nav?: ReactNode;
  /** Pushed to the far right. */
  aside?: ReactNode;
}

export function AppHeader({ nav, aside }: AppHeaderProps) {
  return (
    <header className="flex h-14 flex-none items-center gap-4 border-b border-line bg-surface px-5">
      <Link href="/" aria-label={t('shell.home')} className="rounded-sm">
        <BrandLockup />
      </Link>
      {nav && (
        <>
          <span aria-hidden="true" className="h-6 w-px bg-line" />
          <nav aria-label={t('shell.navLabel')} className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm">
            {nav}
          </nav>
        </>
      )}
      <span className="flex-1" />
      {aside}
      <ThemeToggle />
    </header>
  );
}

/** A header link: muted at rest, ink on hover. */
export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap text-ink-muted hover:text-ink">
      {children}
    </Link>
  );
}
