import { readFileSync } from 'node:fs';
import process from 'node:process';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const version = packageJson.version;

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid SemVer version: ${version}`);
}

if (!changelog.includes(`## [${version}]`)) {
  throw new Error(`CHANGELOG.md does not contain a release heading for ${version}`);
}

const ref = process.env.GITHUB_REF ?? '';
if (ref.startsWith('refs/tags/')) {
  const tag = ref.slice('refs/tags/'.length);
  const expectedTag = `v${version}`;
  if (tag !== expectedTag) {
    throw new Error(`Git tag ${tag} does not match package.json version ${expectedTag}`);
  }
}

console.log(`Version consistency check passed: ${version}`);
