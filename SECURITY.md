# Security policy

## Reporting a vulnerability

Please do not open a public issue for an exploitable vulnerability. Contact the repository owner privately through GitHub and include reproduction steps and impact.

## Secrets and local data

- Never commit `.env`, GitHub tokens, LeetCode credentials/cookies, SQLite databases, or backups.
- GitHub tokens entered in Settings are encrypted with AES-256-GCM before being stored in SQLite. Keep `GITHUB_TOKEN_ENCRYPTION_KEY` private and back it up separately if you need to restore encrypted token access.
- `GITHUB_TOKEN` is optional, read-only where possible, and must only be used server-side.
- LevelUp is a local-first single-user app and currently has no authentication boundary for exposing its server to an untrusted network. Bind/access it locally; do not deploy publicly without adding authentication and CSRF/rate-limit protections.
- API data from GitHub and LeetCode can be incomplete or unavailable; the UI should report source errors rather than inventing values.

## Dependency audit status

The production dependency audit (`npm audit --omit=dev`) is part of CI. Tailwind CSS 4 is used. The remaining full-audit advisories are moderate and limited to the Drizzle Kit/esbuild development dependency chain; npm suggests reverting Drizzle Kit to an older major version. That downgrade is not applied automatically because it may affect schema tooling; track and test a compatible Drizzle Kit upgrade separately.
