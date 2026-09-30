/**
 * Prints a SUPERUSER_PASSWORD_HASH for the superuser (lib/auth/superuser.ts).
 * The password is read from the terminal without echoing it, or from stdin
 * when piped, so it never lands in shell history as an argument.
 *
 *   npm run superuser:hash
 *
 * Put the printed value into Vercel's project settings as
 * SUPERUSER_PASSWORD_HASH, next to SUPERUSER_LOGIN (docs/CI_CD.md, step 7).
 */
import { createInterface } from 'node:readline';
import { hashPassword } from '@/lib/auth/password';

const MIN_LENGTH = 12;

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const ask = (question: string) =>
    new Promise<string>((resolve) => {
      process.stdout.write(question);
      // Swallow the echo: nothing typed is written back to the terminal.
      (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
      rl.question('', (answer) => {
        process.stdout.write('\n');
        resolve(answer);
      });
    });
  const first = await ask('Superuser password: ');
  const second = await ask('Again: ');
  rl.close();
  if (first !== second) {
    throw new Error('The two passwords differ.');
  }
  return first;
}

async function main() {
  const password = await readPassword();
  if (password.length < MIN_LENGTH) {
    throw new Error(`Use at least ${MIN_LENGTH} characters.`);
  }
  console.log(hashPassword(password));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
