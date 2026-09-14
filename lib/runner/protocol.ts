/** Messages between the adapter on the main thread and the worker. */
import type { Dot, PyError, Segment } from './types';

export interface RunRequest {
  type: 'run';
  id: number;
  code: string;
  mode: 'interactive' | 'headless';
  stdin: string[];
  timeoutMs: number;
  randomSeed: number | null;
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
}

export type FromWorker = ReadyMessage | StdoutMessage | InputRequestMessage | DoneMessage;
