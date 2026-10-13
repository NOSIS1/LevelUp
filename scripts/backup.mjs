import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const root = process.cwd();
const source = resolve(root, 'data/levelup.db');
if (!existsSync(source)) {
  console.error('Database does not exist yet. Run npm run setup first.');
  process.exit(1);
}

const outputDirectory = resolve(root, 'backups');
mkdirSync(outputDirectory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = join(outputDirectory, `levelup-${stamp}.db`);
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  const check = db.pragma('quick_check', { simple: true });
  if (check !== 'ok') throw new Error(`SQLite integrity check failed: ${check}`);
  await db.backup(destination);
} finally {
  db.close();
}
const hash = createHash('sha256').update(readFileSync(destination)).digest('hex');
writeFileSync(`${destination}.sha256`, `${hash}  ${destination.split(/[\\/]/).at(-1)}\n`, 'utf8');
console.log(`Backup created and integrity-checked:\n${destination}\nSHA-256: ${hash}`);
