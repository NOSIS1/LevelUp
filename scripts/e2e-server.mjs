import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const databasePath = join(mkdtempSync(join(tmpdir(), 'levelup-e2e-')), 'e2e.db');
const environment = { ...process.env, LEVELUP_DATABASE_PATH: databasePath, PORT: '3100', NEXT_TELEMETRY_DISABLED: '1' };

const migration = spawnSync(npm, ['run', 'db:push'], { cwd: process.cwd(), env: environment, stdio: 'inherit', shell: process.platform === 'win32' });
if (migration.status !== 0) process.exit(migration.status ?? 1);
const build = spawnSync(npm, ['run', 'build'], { cwd: process.cwd(), env: environment, stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(npm, ['run', 'start'], { cwd: process.cwd(), env: environment, stdio: 'inherit', shell: process.platform === 'win32' });
const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 1));
