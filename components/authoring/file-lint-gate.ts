/**
 * The authoring side of the safe-subset rule (docs/TASK_SCHEMA.md, "Safe
 * subset"): a file-delivery task must not itself need what its own upload
 * would reject. tests/references/verify.spec.ts enforces this for seed tasks
 * in CI; this is the same check for a task authored in the browser, run
 * before Publish is offered.
 */
import type { PythonRunner } from '@/lib/runner';
import { lintFile, type LintFinding } from '@/lib/task/file-lint';

export interface LintedSource {
  /** Which program: 'reference', 'starter' or 'broken'. */
  source: 'reference' | 'starter' | 'broken';
  findings: LintFinding[];
}

/**
 * Only sources with findings are returned; an empty array means clean.
 * `null` means the parse itself could not complete — fail closed, same as the
 * student-side upload (components/task/FileDelivery.tsx).
 */
export async function lintForFileDelivery(
  runner: PythonRunner,
  sources: { source: LintedSource['source']; code: string }[]
): Promise<LintedSource[] | null> {
  try {
    const out: LintedSource[] = [];
    for (const { source, code } of sources) {
      const findings = lintFile(await runner.parse(code), code);
      if (findings.length > 0) out.push({ source, findings });
    }
    return out;
  } catch {
    return null;
  }
}
