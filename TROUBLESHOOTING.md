# Troubleshooting

## Node.js version

Use Node.js 20.9+ (Node 22 LTS recommended). Check with `node --version`.

## First install / launch

Run `node scripts/setup.mjs` from the project root. It installs dependencies, creates `.env` only if missing, applies the database schema and starts Next.js. Windows users can run `install.ps1` or `start.ps1`; macOS/Linux users can use `./install.sh` or `./start.sh`.

## CSS or JavaScript returns 404

Do not run `npm run build` while the dev server is active: both use `.next`. Stop all app processes, then run `node scripts/setup.mjs --clean`. This removes only generated `.next`, never `data/`.

## The laptop is slow

The normal setup starts the optimized production server. Use `node scripts/setup.mjs --dev` only when you need hot reload; development mode compiles pages on demand and uses more CPU/RAM.

## Database migration or native SQLite error

Run `npm run db:push`. Before recovery, back up data using `npm run backup`. On Linux, install the build tools required by your Node.js distribution if `better-sqlite3` cannot install its prebuilt binary.

## GitHub GraphQL Contributions

Public REST endpoints can show only a limited set of public events, not the official complete Contributions calendar. To use daily official totals, configure a read-only fine-grained `GITHUB_TOKEN` in local `.env` and restart. Token must never be committed or entered into the browser.

## Port 3000 is already in use

Stop the other LevelUp/Next.js process, then retry. Avoid starting multiple dev servers in the same project directory.

## Restore a backup

Stop the application first, then run `npm run restore -- <backup-file>`. The restore script verifies SQLite integrity and SHA-256 when a checksum file is present and preserves a safety copy of the current database.
