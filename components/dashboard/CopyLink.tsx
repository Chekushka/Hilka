'use client';

/**
 * A link to give the class besides the code: the full address, shown as text
 * and copied in one click — for a chat, an e-journal or a board. The origin is
 * the browser's own, so a preview deploy hands out its own address.
 */
import { useState, useSyncExternalStore } from 'react';
import { t } from '@/lib/i18n';

const noSubscription = () => () => {};

export function useOrigin(): string {
  return useSyncExternalStore(noSubscription, () => window.location.origin, () => '');
}

export function CopyLink({ path, label, compact = false }: { path: string; label?: string; compact?: boolean }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // No clipboard (an http preview, an old browser): select the text instead, so Ctrl+C still works.
      const range = document.createRange();
      const node = document.getElementById(`link-${path}`);
      if (!node) return;
      range.selectNodeContents(node);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      {!compact && (
        <a
          id={`link-${path}`}
          href={path}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate text-sm text-accent underline-offset-4 hover:underline"
          data-testid="copy-link-url"
        >
          {url}
        </a>
      )}
      {compact && (
        <span id={`link-${path}`} className="sr-only">
          {url}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={label ? t('dashboard.copyLinkFor', { what: label }) : t('dashboard.copyLink')}
        className="flex-none rounded-lg border border-accent px-2.5 py-1 text-sm text-accent hover:bg-accent-soft"
        data-testid="copy-link"
      >
        {copied ? t('dashboard.linkCopied') : compact ? t('dashboard.copyLinkShort') : t('dashboard.copyLink')}
      </button>
    </span>
  );
}
