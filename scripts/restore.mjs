import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run restore -- <path-to-backup.db>');
  process.exit(2);
}

const backupPath = resolve(process.cwd(), input);
const databasePath = resolve(process.cwd(), 'data/levelup.db');
if (!existsSync(backupPath) || statSync(backupPath).size === 0) {
  console.error(`Backup file not found or empty: ${backupPath}`);
  process.exit(1);
}
if (backupPath === databasePath) {
  console.error('The backup path must not be the active database path.');
  process.exit(1);
}

const checksumPath = `${backupPath}.sha256`;
if (existsSync(checksumPath)) {
  const expected = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(readFileSync(backupPath)).digest('hex');
  if (expected !== actual) throw new Error('Backup SHA-256 check failed; refusing to restore a damaged or modified file.');
}

const verify = new Database(backupPath, { readonly: true, fileMustExist: true });
try {
  const check = verify.pragma('quick_check', { simple: true });
  if (check !== 'ok') throw new Error(`Backup failed SQLite integrity check: ${check}`);
  const tables = verify.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table'").get();
  if (!tables?.count) throw new Error('Backup has no tables');
} finally {
  verify.close();
}

mkdirSync(dirname(databasePath), { recursive: true });
if (existsSync(databasePath)) {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const safetyCopy = join(resolve(process.cwd(), 'backups'), `before-restore-${stamp}.db`);
  mkdirSync(dirname(safetyCopy), { recursive: true });
  const active = new Database(databasePath);
  try {
    await active.backup(safetyCopy);
  } finally {
    active.close();
  }
  console.log(`Safety backup of current database: ${safetyCopy}`);
  const replacePath = `${databasePath}.restore-tmp`;
  copyFileSync(backupPath, replacePath);
  const archivedCurrent = `${databasePath}.${stamp}.pre-restore`;
  renameSync(databasePath, archivedCurrent);
  try {
    renameSync(replacePath, databasePath);
  } catch (error) {
    renameSync(archivedCurrent, databasePath);
    throw error;
  }
  console.log(`Previous database retained at: ${archivedCurrent}`);
} else {
  copyFileSync(backupPath, databasePath);
}
console.log('Database restored. Start the app and check the data before deleting backups.');
