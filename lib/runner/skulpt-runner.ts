/**
 * The Skulpt adapter. The only implementation of PythonRunner today; the
 * interface exists so it does not have to be the only one forever.
 */
import type { FromWorker, RunRequest, ToWorker } from './protocol';
import type { ParseResult, PythonRunner, RunOptions, RunResult } from './types';

const DEFAULT_TIMEOUT_MS = 5000;

interface Pending {
  resolve: (result: RunResult) => void;
  reject: (error: Error) => void;
  options: RunOptions;
}

export class SkulptRunner implements PythonRunner {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  /** Keyed by request id: parses are independent of the one run in flight. */
  private parses = new Map<number, { resolve: (result: ParseResult) => void; reject: (error: Error) => void }>();
  private nextId = 1;
  private ready: Promise<void> | null = null;
  private markReady: (() => void) | null = null;

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }
    this.ready = new Promise<void>((resolve) => {
      this.markReady = resolve;
    });
    const worker = new Worker(new URL('./worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<FromWorker>) => this.receive(event.data);
    this.worker = worker;
    return worker;
  }

  warmUp(): Promise<void> {
    this.ensureWorker();
    return this.ready ?? Promise.resolve();
  }

  private receive(message: FromWorker): void {
    if (message.type === 'ready') {
      this.markReady?.();
      this.markReady = null;
      return;
    }
    if (message.type === 'parsed') {
      this.parses.get(message.id)?.resolve(message.result);
      this.parses.delete(message.id);
      return;
    }
    if (!this.pending) {
      return;
    }
    const pending = this.pending;
    if (message.type === 'stdout') {
      pending.options.onStdout?.(message.chunk);
      return;
    }
    if (message.type === 'input-request') {
      const ask = pending.options.onInputRequest;
      if (!ask) {
        // Nothing is listening, so answering with an empty line beats hanging
        // until the timeout with no explanation.
        this.worker?.postMessage({ type: 'input', id: message.id, value: '' } satisfies ToWorker);
        return;
      }
      void ask(message.prompt).then((value) => {
        this.worker?.postMessage({ type: 'input', id: message.id, value } satisfies ToWorker);
      });
      return;
    }
    this.pending = null;
    pending.resolve({
      stdout: message.stdout,
      error: message.error,
      drawing: message.drawing,
      dots: message.dots,
      timedOut: message.timedOut,
      inputsConsumed: message.inputsConsumed,
      elapsedMs: message.elapsedMs,
      vars: message.vars,
      exprResults: message.exprResults
    });
  }

  run(code: string, options: RunOptions): Promise<RunResult> {
    if (this.pending) {
      return Promise.reject(new Error('A run is already in progress'));
    }
    const worker = this.ensureWorker();
    const request: RunRequest = {
      type: 'run',
      id: this.nextId++,
      code,
      mode: options.mode,
      stdin: options.stdin ?? [],
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      randomSeed: options.randomSeed ?? null,
      exprs: options.exprs ?? []
    };
    return new Promise<RunResult>((resolve, reject) => {
      this.pending = { resolve, reject, options };
      worker.postMessage(request satisfies ToWorker);
    });
  }

  async parse(code: string): Promise<ParseResult> {
    const worker = this.ensureWorker();
    await this.ready;
    const id = this.nextId++;
    return new Promise<ParseResult>((resolve, reject) => {
      this.parses.set(id, { resolve, reject });
      worker.postMessage({ type: 'parse', id, code } satisfies ToWorker);
    });
  }

  /**
   * Hard stop. Sk.execLimit handles a runaway loop cooperatively; this is for
   * when that is not enough, and costs a worker restart (~80 ms).
   */
  cancel(): void {
    if (!this.pending) {
      return;
    }
    const pending = this.pending;
    this.pending = null;
    this.dispose();
    pending.resolve({
      stdout: '',
      error: null,
      drawing: [],
      dots: [],
      timedOut: true,
      inputsConsumed: 0,
      elapsedMs: 0,
      vars: {},
      exprResults: {}
    });
  }

  dispose(): void {
    // A parse cut off by a restart can never be answered. Rejecting, not
    // resolving as a failed parse: that would read as "unparseable" and let
    // the file skip the linter.
    this.parses.forEach(({ reject }) => reject(new Error('Runner restarted during parse')));
    this.parses.clear();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.markReady = null;
  }
}
