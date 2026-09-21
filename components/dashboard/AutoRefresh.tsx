'use client';

/**
 * Keeps a server-rendered dashboard page live while a teacher is watching a
 * session run — no client-side data layer of its own, just re-running the
 * server component on an interval (docs/TASKS.md, "Results dashboard").
 * Renders nothing; mount it anywhere on the page it should refresh.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  everyMs: number;
}

export function AutoRefresh({ everyMs }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);

  return null;
}
