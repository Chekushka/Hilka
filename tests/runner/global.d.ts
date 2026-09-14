import type { RunResult } from '@/lib/runner';

declare global {
  interface Window {
    __runner__?: {
      run(code: string, options: { mode: 'headless'; stdin?: string[]; timeoutMs?: number; randomSeed?: number }): Promise<RunResult>;
      runInteractive(code: string, answers: string[], delayMs: number): Promise<RunResult>;
    };
  }
}
