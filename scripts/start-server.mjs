import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const setup = spawnSync(process.execPath, ['scripts/ensure-env-key.mjs'], { cwd: process.cwd(), stdio: 'inherit' });
if (setup.status !== 0) process.exit(setup.status ?? 1);

const child = spawn('next', ['start', '--hostname', '127.0.0.1'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const stop = () => { if (!child.killed) child.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('error', (error) => { console.error(error); process.exit(1); });
child.on('close', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
