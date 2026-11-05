# deploy-ready — make the monorepo deployable to Vercel (code + docs only)

Branch `chore/deploy-ready` (from `dev`), commit `1513b1e`. Nothing was deployed; no Vercel access.

## Built
- **ESM audit.** Every `apps/api` runtime dependency passes `node -e "require('<pkg>')"`: the 4 `@nestjs/*`
  packages, `@prisma/adapter-pg`, `@prisma/client`, `@vercel/blob`, `bcryptjs`, `class-*`, `passport*`, `rxjs`,
  `sharp`, `zod` and `@muayana/shared`. The compiled `dist/app.module.js` also requires cleanly. Nothing to pin.
- **Pool.** `poolOptions` (adapter-pg `max: 1`, `connectionTimeoutMillis: 20000` when `VERCEL` is set) and the
  single `DatabaseService` client were already in place. I reviewed every `$transaction` callback in categories,
  issues, sites and workers: all of them pass `tx`. New `npm run test:e2e:serverless`
  (`test/jest-e2e-serverless.json` + `test/setup-serverless-pool.ts`, sets `VERCEL=1`) runs the e2e suite on the
  1-connection pool. **Probe:** I temporarily added a plain-client query inside `SitesService.create`'s transaction.
  Under the serverless config, 5 of the 12 sites e2e tests failed. I then reverted the probe.
- **Build.** `apps/api/vercel.json` (preset `nestjs`, install `cd ../.. && npm ci`, build: shared →
  `prisma generate` → `nest build`, no migrate, `main.ts`/`app.listen` unchanged). `apps/web/vercel.json` (preset
  `nextjs`, same install, shared → `next build`). `.gitignore` keeps `!.env.example`. I ran both build commands
  from a clean state (`rm -rf` shared `dist`, api `dist`, web `.next`):
  - API: `✔ Generated Prisma Client (v7.10.1)` and `nest build` exit 0.
  - Web: `✓ Generating static pages (17/17)`, route table printed, exit 0.
- **Blob.** New `blob-photo.storage.spec.ts` mocks `put` and checks it is called with `access: 'public'`,
  `addRandomSuffix: true`, `contentType: 'image/jpeg'` and the token; it also mocks `del`.
  `storage.module.spec.ts` checks which driver the factory picks. `app.setup.spec.ts` checks that `/uploads` is
  served with the local driver and **not** with blob, and checks the `trust proxy` toggle.
- **Env.** `apps/api/.env.example` lists every variable with a comment, including `DATABASE_URL_UNPOOLED` (for
  migrations only) and which variables must not be set on Vercel (`NODE_ENV`, `PORT`, `UPLOAD_DIR`,
  `PUBLIC_UPLOAD_BASE_URL`, `SEED_*`, `VERCEL`). `apps/web/.env.example` covers `API_URL` and `DEV_ORIGINS`.
- **Docs.** `docs/DEPLOY.md` is the full guide, and README has a Deploy section, a doc link and the new script.

## Tests
- API unit: `Test Suites: 23 passed` · `Tests: 135 passed`.
- API e2e on `muayana_deploy`: `Test Suites: 9 passed` · `Tests: 122 passed`.
- API e2e on the 1-connection pool: `Test Suites: 9 passed` · `Tests: 122 passed`.
- `npm run lint` and `npm run typecheck` pass.

## Findings for the user (all in DEPLOY.md)
- **Preview Deployment Protection** blocks web→API calls from server code. The guide says to turn off Vercel
  Authentication on `muayana-api`.
- **Login rate limit** uses an in-memory store, so on Vercel it is per function instance and resets when an
  instance restarts. Vercel may also replace `X-Forwarded-For` with the address of the web server that called the
  API, which would make every sign-in share one counter. The guide includes the 5-wrong-logins test and the
  `TRUST_PROXY` fallback the brief asked for. A sturdier fix (a dedicated client-IP header from the proxy, or a
  database-backed store) is a follow-up task, not done here.
- **Seed sample photos** are written to the local disk with local URLs, so they show as broken images on Preview.
- **Photo upload size**: Vercel's request limit is 4.5 MB and the client compresses photos to ≤ 4 MB
  (`PHOTO_MAX_BYTES`), so uploads fit.

## Deviations
- None to business rules. I did not touch `apps/web/src/components/**` or `apps/web/src/app/(app)/**`.
