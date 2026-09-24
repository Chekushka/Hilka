/**
 * Import Python execution from here. Nothing outside this directory may import
 * Skulpt, the worker, or the adapter directly.
 */
import { SkulptRunner } from './skulpt-runner';
import type { PythonRunner } from './types';

export function createRunner(): PythonRunner {
  return new SkulptRunner();
}

export type {
  Dot,
  ParseResult,
  PyAstNode,
  PyAstValue,
  PyError,
  PythonRunner,
  PyValue,
  RunOptions,
  RunResult,
  Segment
} from './types';
