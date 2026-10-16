import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import process from 'node:process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const log = createWriteStream('ci-build.log', { flags: 'w' });
const child = spawn(npm, ['run', 'build:next'], { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });

function forward(chunk) {
  process.stdout.write(chunk);
  log.write(chunk);
}

child.stdout.on('data', forward);
child.stderr.on('data', forward);
child.on('error', (error) => {
  forward(`${error.stack || error}\n`);
  log.end(() => process.exit(1));
});
child.on('close', (code, signal) => {
  log.end(() => process.exit(code ?? (signal ? 1 : 0)));
});
