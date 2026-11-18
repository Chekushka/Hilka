import type { ReactNode } from 'react';

/**
 * The projector window: nothing but what the class reads from the back row —
 * no app bar, no navigation. Opened from a session's page by the teacher.
 */
export default function ProjectorLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-1 flex-col bg-bg">{children}</div>;
}
