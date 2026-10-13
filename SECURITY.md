# Security policy

## Reporting a vulnerability

Please do not open a public issue for an exploitable vulnerability. Contact the repository owner privately through GitHub and include reproduction steps and impact.

## Secrets and local data

- Never commit `.env`, GitHub tokens, LeetCode credentials/cookies, SQLite databases, or backups.
- `GITHUB_TOKEN` is optional, read-only where possible, and must only be used server-side.
- LevelUp is a local-first single-user app and currently has no authentication boundary for exposing its server to an untrusted network. Bind/access it locally; do not deploy publicly without adding authentication and CSRF/rate-limit protections.
- API data from GitHub and LeetCode can be incomplete or unavailable; the UI should report source errors rather than inventing values.

## Dependency audit status

The production dependency audit (`npm audit --omit=dev`) is part of CI. The development toolchain currently includes advisories in Tailwind CSS 3 / Drizzle Kit transitive packages; npm's suggested automatic fixes require major upgrades (Tailwind CSS 4 and a Drizzle Kit beta). These are not auto-applied because they may break the current styling/database workflow; schedule and test that migration separately.
