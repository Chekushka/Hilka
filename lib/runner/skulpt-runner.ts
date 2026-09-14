/**
 * The Skulpt adapter. The only implementation of PythonRunner today; the
 * interface exists so it does not have to be the only one forever.
 */
import type { FromWorker, RunRequest, ToWorker } from './protocol';
import type { PythonRunner, RunOptions, RunResult } from './types';

const DEFAULT_TIMEOUT_MS = 5000;

interface Pending {
  resolve: (result: RunResult) => void;
  reject: (error: Error) => void;
  options: RunOptions;
}

export class SkulptRunner implements PythonRunner {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private nextId = 1;

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<FromWorker>) => this.receive(event.data);
    this.worker = worker;
    return worker;
  }

  private receive(message: FromWorker): void {
    if (message.type === 'ready' || !this.pending) {
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
      elapsedMs: message.elapsedMs
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
      randomSeed: options.randomSeed ?? null
    };
    return new Promise<RunResult>((resolve, reject) => {
      this.pending = { resolve, reject, options };
      worker.postMessage(request satisfies ToWorker);
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
      elapsedMs: 0
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
