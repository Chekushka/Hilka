import type { GridWorld, ParseResult, RunResult } from '@/lib/runner';

declare global {
  interface Window {
    __runner__?: {
      run(
        code: string,
        options: {
          mode: 'headless';
          stdin?: string[];
          timeoutMs?: number;
          randomSeed?: number;
          exprs?: string[];
          grid?: GridWorld;
        }
      ): Promise<RunResult>;
      runInteractive(code: string, answers: string[], delayMs: number): Promise<RunResult>;
      inputLines(code: string, answers: string[]): Promise<(number | null)[]>;
      parse(code: string): Promise<ParseResult>;
    };
  }
}
