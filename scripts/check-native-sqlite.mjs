import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

try {
  const Database = require('better-sqlite3');
  const database = new Database(':memory:');
  database.pragma('quick_check');
  database.close();
  console.log('SQLite native binding is ready.');
} catch (error) {
  console.error('SQLite native binding is unavailable.');
  console.error(error instanceof Error ? error.message : error);
  if (process.platform === 'linux') {
    console.error('On Debian/Ubuntu install build tools: sudo apt-get install -y build-essential python3');
  }
  console.error('Then run: npm rebuild better-sqlite3 --foreground-scripts');
  process.exit(1);
}
