/**
 * The subset of the task contract the workspace needs today. The full shape is
 * in docs/TASK_SCHEMA.md; this grows toward it as the types are built, rather
 * than being declared in full and left half-implemented.
 */
import type { Check } from '@/lib/checker';

export interface CodeTask {
  id: string;
  topicId: string;
  type: 'code';
  title: string;
  payload: {
    type: 'code';
    surface: 'console' | 'turtle' | 'grid';
    prompt: string;
    starter: string;
  };
  checks: Check[];
  hints: string[];
  reference: { code: string };
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: 'draft' | 'published' | 'archived';
}
