import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) copyFileSync(examplePath, envPath);
  else writeFileSync(envPath, '', 'utf8');
}

const key = randomBytes(32).toString('hex');
let content = readFileSync(envPath, 'utf8');
const match = /^GITHUB_TOKEN_ENCRYPTION_KEY=(.*)$/m.exec(content);

if (!match) {
  content += `${content.endsWith('\n') || content.length === 0 ? '' : '\n'}GITHUB_TOKEN_ENCRYPTION_KEY=${key}\n`;
  writeFileSync(envPath, content, 'utf8');
  console.log('Created GITHUB_TOKEN_ENCRYPTION_KEY in local .env');
} else if (match[1].trim() === '') {
  writeFileSync(envPath, content.replace(match[0], `GITHUB_TOKEN_ENCRYPTION_KEY=${key}`), 'utf8');
  console.log('Created GITHUB_TOKEN_ENCRYPTION_KEY in local .env');
} else if (!/^[a-f0-9]{64}$/i.test(match[1].trim())) {
  console.error('GITHUB_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
  process.exit(1);
}
