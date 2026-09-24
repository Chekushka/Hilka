/**
 * Runs scripts/safe-subset/corpus.ts on Skulpt (Hilka's engine, stubs
 * included) and on real CPython, and checks every name on
 * lib/task/file-lint.ts's allow-lists is confirmed by an entry whose output
 * matched. An allow-list entry with no matching evidence fails the run —
 * the safe subset grows only from something that actually ran
 * (docs/TASK_SCHEMA.md, "Safe subset").
 *
 *   npm run confirm:safe-subset             # uses `python3`
 *   PYTHON=py npm run confirm:safe-subset   # the classroom machine's interpreter
 *
 * Re-run after any runner change, and on the classroom machine's Python.
 */
import { spawnSync } from 'node:child_process';
import { parseInNode, runInNode } from '@/lib/runner/node';
import { collectUsage, exercisedNames, SAFE_SUBSET } from '@/lib/task/file-lint';
import { CORPUS, CORPUS_STDIN } from './corpus';

const python = process.env.PYTHON ?? 'python3';

function runCPython(code: string): { stdout: string; error: string | null } {
  const result = spawnSync(python, ['-c', code], {
    input: CORPUS_STDIN.join('\n') + '\n',
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  if (result.error) throw result.error;
  const stderr = result.stderr.trim();
  return { stdout: result.stdout, error: result.status === 0 ? null : stderr.split('\n').pop() ?? stderr };
}

function cell(text: string): string {
  return text.replace(/\n/g, '⏎').replace(/\|/g, '\\|').slice(0, 120);
}

async function main() {
  const version = spawnSync(python, ['--version'], { encoding: 'utf8' }).stdout.trim();
  const confirmed = new Set<string>();
  const rows: string[] = [];
  let divergent = 0;
  const overclaims: string[] = [];

  for (const entry of CORPUS) {
    const cpython = runCPython(entry.code);
    const skulpt = await runInNode(entry.code, CORPUS_STDIN);
    const match = cpython.error === null && skulpt.error === null && cpython.stdout === skulpt.stdout;
    if (match) {
      // A claim counts only if the entry's own tree really exercises it —
      // the linter's own reading of the program, not the author's.
      const parsed = parseInNode(entry.code);
      const exercised = parsed.ok ? exercisedNames(collectUsage(parsed.ast))[entry.confirms.kind] : new Set<string>();
      for (const name of entry.confirms.names) {
        if (exercised.has(name)) confirmed.add(`${entry.confirms.kind}:${name}`);
        else overclaims.push(`${entry.id} claims ${entry.confirms.kind}:${name} but never exercises it`);
      }
    } else {
      divergent += 1;
    }
    const detail = match
      ? ''
      : `CPython: ${cell(cpython.error ?? cpython.stdout)} — Skulpt: ${cell(skulpt.error ?? skulpt.stdout)}`;
    rows.push(`| \`${entry.id}\` | ${match ? 'Match' : '**Differs**'} | ${detail} |`);
  }

  console.log(`CPython: ${version}\n`);
  console.log('| Entry | Result | Divergence |');
  console.log('|---|---|---|');
  rows.forEach((row) => console.log(row));

  const unconfirmed: string[] = [];
  for (const [kind, names] of Object.entries(SAFE_SUBSET)) {
    for (const name of names) {
      if (!confirmed.has(`${kind}:${name}`)) unconfirmed.push(`${kind}:${name}`);
    }
  }
  console.log(`\n${CORPUS.length - divergent} of ${CORPUS.length} entries match.`);
  if (overclaims.length > 0) {
    console.error(`\nCorpus entries claiming what they do not run:\n  ${overclaims.join('\n  ')}`);
    process.exit(1);
  }
  if (unconfirmed.length > 0) {
    console.error(`\nOn the allow-list without matching evidence:\n  ${unconfirmed.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Every allow-list entry is confirmed.');
}

void main();
