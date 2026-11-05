# Muayana — Project Instructions

Site-audit / snag tracker for one audit engineer: capture defect photos on site (offline-first PWA),
sort them by trade, assign and send them to workers on WhatsApp, track every issue to solved, export
CSV. Arabic (RTL, default) + English. Built with `/build-software` (fully autonomous run).

Stack: NestJS + Prisma (`apps/api`), Next.js + Tailwind v4 + shadcn/ui + next-intl (`apps/web`),
shared zod schemas, enums and types (`packages/shared`). Postgres (Neon when deployed), photos in
Vercel Blob (local disk in dev/test).

## Read first
- `docs/BUSINESS_LOGIC.md` — the source of truth for how the business behaves. Read the index,
  then only the § files the task touches. Every behavior change updates it in the same commit and
  bumps its `Last updated` line.
- `docs/BUILD_LOG.md` — where the run is and what is next; task reports in `docs/build-log/`.
- `docs/specs/` — spec and API contract; `docs/DESIGN.md` — design direction (values live in
  `apps/web/src/app/globals.css`).

## Branches
- `production` — live. Merged only through a release PR.
- `dev` — default branch and integration.
- Work on `feature/<name>`, `fix/<name>`, `chore/<name>` cut from `dev`, merged by PR.

## Conventions
- Ports: API 3101, web 3100, Postgres 5442 (docker project `muayana`). Parallel agent N: API 31N1,
  web 31N3, its own database from `npm run db:agent -- create <name> --agent N`.
- `schema.prisma` changes go through one task at a time; locale files are per namespace
  (`apps/web/messages/{ar,en}/<ns>.json`, registered in `src/i18n/config.ts`); `app.module.ts`
  edits are additive imports only.
- `npm run lint` and `npm run typecheck` pass before every commit.

## Secrets
- Test logins and the integrations register live in `CREDENTIALS.local.md` (gitignored). Never
  commit a credential, key, `.env`, or client data; `.env.example` files hold placeholders only.
