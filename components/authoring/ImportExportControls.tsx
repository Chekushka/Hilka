'use client';

/**
 * Backup and handoff for the whole task catalog (docs/TASKS.md, "JSON
 * export/import of all tasks"). Export is a plain link to the route handler
 * — the browser downloads the file, no client state needed. Import reads a
 * chosen file, posts its parsed JSON, and refreshes the list on success.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { t } from '@/lib/i18n';

export function ImportExportControls() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFileChosen(file: File) {
    setImporting(true);
    setStatus(null);
    setError(null);
    try {
      const text = await file.text();
      const body: unknown = JSON.parse(text);
      const response = await fetch('/api/tasks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(t('authoring.importError'));
        return;
      }
      const { topicsImported, tasksImported } = result as { topicsImported: number; tasksImported: number };
      setStatus(t('authoring.importSuccess', { topics: topicsImported, tasks: tasksImported }));
      router.refresh();
    } catch {
      setError(t('authoring.importInvalidJson'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <Link href="/api/tasks/export" className="rounded-md border border-line px-3 py-1.5 text-ink">
        {t('authoring.exportAll')}
      </Link>
      <label className="rounded-md border border-line px-3 py-1.5 text-ink">
        {importing ? t('authoring.importing') : t('authoring.importAll')}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          disabled={importing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFileChosen(file);
          }}
        />
      </label>
      {status && <span className="text-growth">{status}</span>}
      {error && <span className="text-attention">{error}</span>}
    </div>
  );
}
