# Ambrosia

A static, offline-first wellness journal with optional Supabase account synchronization and a server-side Groq proxy. Open it through Netlify to use the functions and redirects in `netlify.toml`; no application build or application npm dependencies are required.

- [Production security, AI/Premium configuration and privacy checklist](docs/security-production.md)
- [Browser-only deployment and manual acceptance checklist](docs/deployment.md)
- [Synchronization architecture, consent, conflicts and limitations](docs/synchronization.md)
- [Supabase migrations](supabase/README.md)

Automated checks run in GitHub Actions. Developer commands are `npm test`, `npm run test:browser` (Playwright/Chromium) and `npm run test:db` (Docker). Browser tests start their own static server and use test-only auth/transport fixtures. Database tests use an isolated PostgreSQL container, never production credentials. The owner does not need to install these tools.
