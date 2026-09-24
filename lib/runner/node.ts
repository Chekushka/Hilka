/**
 * The Node-side entry to the runner, for scripts and unit tests — the
 * counterpart of index.ts, which is the browser's. Import Python-in-Node from
 * here, never from the Skulpt adapter behind it (CLAUDE.md rule 3). Never
 * imported by app code: the product runs Python only in the Worker.
 */
export { parseInNode, runInNode, type NodeRunResult } from './node-skulpt';
