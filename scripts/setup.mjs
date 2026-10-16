import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(`LevelUp requires Node.js 20.9 or newer. Current: ${process.version}`);
  console.error('Install an LTS release from https://nodejs.org and run this script again.');
  process.exit(1);
}

console.log(`LevelUp setup · Node ${process.version} · ${process.platform}/${process.arch}`);
if (!existsSync(resolve(root, 'node_modules/next'))) {
  console.log('\n[1/4] Installing dependencies');
  run(npm, existsSync(resolve(root, 'package-lock.json')) ? ['ci'] : ['install']);
} else {
  console.log('\n[1/4] Dependencies already installed');
}

if (!existsSync(resolve(root, '.env'))) {
  if (existsSync(resolve(root, '.env.example'))) {
    copyFileSync(resolve(root, '.env.example'), resolve(root, '.env'));
    console.log('[2/4] Created local .env from .env.example (no secrets included)');
  }
} else {
  console.log('[2/4] Keeping existing .env unchanged');
}

mkdirSync(resolve(root, 'data'), { recursive: true });
console.log('[3/4] Applying SQLite schema (existing database is preserved)');
run(npm, ['run', 'db:push']);

if (args.has('--check')) {
  console.log('\n[4/4] Running quality checks');
  run(npm, ['run', 'type-check']);
  run(npm, ['test']);
  if (!args.has('--quick-check')) run(npm, ['run', 'build']);
  console.log('\nSetup and checks complete.');
  process.exit(0);
}

if (args.has('--clean')) {
  console.log('\nRemoving only generated Next.js build cache (.next)');
  rmSync(resolve(root, '.next'), { recursive: true, force: true });
  rmSync(resolve(root, '.next-dev'), { recursive: true, force: true });
}

if (args.has('--dev')) {
  console.log('\nClearing generated Next.js cache before development start');
  rmSync(resolve(root, '.next-dev'), { recursive: true, force: true });
  console.log('\n[4/4] Starting development server (slower; compiles pages on demand)');
  run(npm, ['run', 'dev']);
} else if (args.has('--install-only')) {
  console.log('\nSetup complete. Run setup normally for the optimized server or add --dev for hot reload.');
} else {
  console.log('\n[4/4] Building optimized production server');
  run(npm, ['run', 'build']);
  run(npm, ['run', 'start']);
}
