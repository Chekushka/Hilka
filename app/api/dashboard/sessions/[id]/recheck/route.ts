/**
 * What the teacher's re-check needs (docs/HOMEWORK.md, section 5, threat 5):
 * every passed attempt in the session with what was submitted, and each task
 * exactly as that student saw it — a parameterized task resolved to their own
 * variant, as `GET /api/sessions/[code]/tasks/[taskId]` did for them. The
 * re-running happens in the teacher's browser (components/dashboard/RecheckPanel.tsx);
 * there is no server-side Python. An attempt on an older version of a task
 * than the one published now is marked, not re-checked: its checks may have
 * changed since. Owner-scoped.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listPassedAnswers } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import { getPublishedTaskById } from '@/lib/db/tasks';
import { deriveSeed } from '@/lib/seed';
import { isParameterized, resolveTaskParams } from '@/lib/task/params';
import type { RecheckItem } from '@/lib/task/recheck';
import type { Task } from '@/lib/task/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSessionForTeacher(id, teacher.id);
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const answers = await listPassedAnswers(session.id);
  const tasks = new Map<string, Task | null>();
  for (const taskId of new Set(answers.map((answer) => answer.taskId))) {
    tasks.set(taskId, await getPublishedTaskById(taskId));
  }

  const items: RecheckItem[] = answers.map((answer) => {
    const task = tasks.get(answer.taskId) ?? null;
    const current = task !== null && task.version === answer.taskVersion ? task : null;
    const seen =
      current && isParameterized(current)
        ? resolveTaskParams(current, deriveSeed(session.id, answer.studentName, current.id))
        : current;
    return {
      attemptId: answer.id,
      studentName: answer.studentName,
      taskTitle: answer.taskTitle,
      createdAt: answer.createdAt,
      submittedAnswer: answer.submittedAnswer,
      task: seen
    };
  });
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
