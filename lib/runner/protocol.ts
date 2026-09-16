/** Messages between the adapter on the main thread and the worker. */
import type { Dot, PyError, PyValue, Segment } from './types';

export interface RunRequest {
  type: 'run';
  id: number;
  code: string;
  mode: 'interactive' | 'headless';
  stdin: string[];
  timeoutMs: number;
  randomSeed: number | null;
  exprs: string[];
}

export interface InputResponse {
  type: 'input';
  id: number;
  value: string;
}

export type ToWorker = RunRequest | InputResponse;

export interface ReadyMessage {
  type: 'ready';
}

export interface StdoutMessage {
  type: 'stdout';
  id: number;
  chunk: string;
}

export interface InputRequestMessage {
  type: 'input-request';
  id: number;
  prompt: string;
}

export interface DoneMessage {
  type: 'done';
  id: number;
  stdout: string;
  error: PyError | null;
  drawing: Segment[];
  dots: Dot[];
  timedOut: boolean;
  inputsConsumed: number;
  elapsedMs: number;
  vars: Record<string, PyValue>;
  exprResults: Record<string, boolean>;
}

export type FromWorker = ReadyMessage | StdoutMessage | InputRequestMessage | DoneMessage;
