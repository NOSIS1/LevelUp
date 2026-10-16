import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const generatedFiles = ['next-env.d.ts', 'tsconfig.json'];
const originals = new Map(generatedFiles.map((file) => [file, readFileSync(file, 'utf8')]));

const command = process.platform === 'win32' ? 'next.cmd' : 'next';
const child = spawn(command, ['dev', '--turbopack', '--hostname', '127.0.0.1'], {
  cwd: process.cwd(),
  env: { ...process.env, NEXT_DIST_DIR: '.next-dev' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

let cleanedUp = false;
const restoreGeneratedFiles = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const [file, content] of originals) writeFileSync(file, content);
};

const stop = () => {
  if (!child.killed) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('error', (error) => {
  restoreGeneratedFiles();
  console.error(error);
  process.exit(1);
});
child.on('close', (code, signal) => {
  restoreGeneratedFiles();
  process.exit(code ?? (signal ? 1 : 0));
});
