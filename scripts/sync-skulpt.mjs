// Copies the Skulpt distribution into public/runner/ so the worker can load it
// with importScripts at a stable URL. Skulpt is a UMD bundle, not an ES module,
// so it cannot be imported — and pinning it in package.json beats vendoring
// 945 KB into git twice.
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const FILES = ['skulpt.min.js', 'skulpt-stdlib.js'];
const from = 'node_modules/skulpt/dist';
const to = 'public/runner';

if (!existsSync(from)) {
  console.error(`sync-skulpt: ${from} not found — run npm install first`);
  process.exit(1);
}

await mkdir(to, { recursive: true });
for (const file of FILES) {
  await copyFile(`${from}/${file}`, `${to}/${file}`);
}
console.log(`sync-skulpt: copied ${FILES.join(', ')} to ${to}/`);
