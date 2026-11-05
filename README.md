# Muayana · معاينة

A site-audit / snag tracker for one audit engineer: photograph defects on site (works offline),
sort them by trade, send them to workers on WhatsApp, and track each one until it is solved.

- Business rules: [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md)
- Spec and API contract: [docs/specs/](docs/specs/)
- Design: [docs/DESIGN.md](docs/DESIGN.md) — live preview at `/design` (dev only)
- Build progress: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)
- Deploy: [docs/DEPLOY.md](docs/DEPLOY.md)

## Stack

npm workspaces: `apps/api` (NestJS 11, Prisma 7, Postgres 16), `apps/web` (Next.js 16, Tailwind 4,
shadcn/ui, next-intl — Arabic default, English), `packages/shared` (zod contract schemas, enums,
inferred types; built to `dist`).

## Run it locally

Needs Node 24 and Docker.

```bash
npm install                                  # also builds packages/shared and generates Prisma
npm run db:up                                # Postgres 16 on localhost:5442 (project "muayana")
cp apps/api/.env.example apps/api/.env       # then set a long random JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate                           # prisma migrate deploy on the dev database
npm run db:seed                              # stub until T2 (engineer + categories)
npm run dev:api                              # http://localhost:3101/api/v1/health
npm run dev:web                              # http://localhost:3100 (and /design)
```

Port 5442 is also Prime Property's local Postgres port: stop that project's database first
(`docker compose -p prime-crm down`) if both are on one machine.

## Deploy

Two Vercel projects from this repo — `muayana-api` (Root Directory `apps/api`) and `muayana-web`
(Root Directory `apps/web`), Neon Postgres and a public Vercel Blob store. Step-by-step guide, env
vars per environment, migrations, smoke checklist and rollback: [docs/DEPLOY.md](docs/DEPLOY.md).

## Scripts

| Script | Does |
|---|---|
| `dev:api` / `dev:web` | API on 3101, web on 3100 |
| `db:up` / `db:down` | start / stop the Postgres container |
| `db:migrate` | apply migrations to `apps/api/.env`'s database |
| `db:seed` | seed (stub for now) |
| `db:agent` | per-agent databases (below) |
| `lint` / `typecheck` | every workspace |
| `test` | unit: jest (api), vitest (web, shared) |
| `test:e2e` | API e2e (jest + supertest) against a dedicated database |
| `test:e2e:serverless` | the same suite with Vercel's one-connection pool (catches a query outside its transaction) |
| `test:smoke` | Playwright `@smoke` specs (mobile Pixel 7 + desktop) |

## Tests

- **API e2e** reads `DATABASE_URL` and `PORT`/`API_PORT` from the environment, falling back to
  `apps/api/.env.test` (copy `.env.test.example`; it points at `muayana_test`, created by the
  container on first start). It refuses the development database (`muayana`) and the template.
- **Parallel agents** each get their own database and port block:
  ```bash
  npm run db:agent -- create t5 --agent 5   # prints DATABASE_URL (muayana_t5), API 3151, web 3153
  DATABASE_URL=... API_PORT=3151 npm run test:e2e
  npm run db:agent -- drop t5
  ```
  `create` refreshes `muayana_template` (all migrations + seed) and copies it.
- **Playwright** starts `next dev` on `WEB_PORT` (or tests `BASE_URL`); nothing hardcodes a port:
  `WEB_PORT=3100 npm run test:smoke`.
