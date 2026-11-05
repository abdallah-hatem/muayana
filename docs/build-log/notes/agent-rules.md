# Rules for every build-task agent (read fully before starting)

Repo `D:\Personal\muayana` (Windows; Git Bash + PowerShell; Node 24; Docker Postgres on 5442 must be up — `npm run db:up`).

## Setup in your worktree
1. `git switch -c <your branch> <base branch named in the brief>` FIRST — worktrees start from a stale commit otherwise.
2. `npm install` at the root (its postinstall builds `@muayana/shared` and generates the Prisma client). Copy
   `apps/api/.env` and `apps/api/.env.test` from the main checkout `D:\Personal\muayana\apps\api\` (gitignored, local-only).
3. Your own database: `npm run db:agent -- create <task> --agent <N>` (prints the URL and ports). Point
   `DATABASE_URL` at it for e2e. Use only your port block (API `31N1`, web `31N3`). Tear down only what you started.
4. Never run `prisma migrate dev` against shared DBs from a worktree with a linked node_modules. If your task needs a
   schema change, edit `schema.prisma` and create the migration with `prisma migrate dev --create-only` against YOUR
   agent DB, then `migrate deploy`.

## Working rules
- Load the stack skill named in the brief first (`abdallah-skills:building-backends` / `abdallah-skills:building-frontends`).
- Read `CLAUDE.md`, `docs/BUSINESS_LOGIC.md` (index) and only the § files your brief names. Frontend: `docs/DESIGN.md`,
  `apps/web/src/app/globals.css` tokens, `apps/web/src/app/design/` (the reference look) and `docs/design/mockup.html`
  (the approved mockup screens). Tokens only — no new colours/sizes/curves. Mobile-first: design for 360px, then md+.
- Existing code first: grep `packages/shared`, `apps/api/src/common`, `apps/web/src/components`, `apps/web/src/lib`
  before writing a helper/component/DTO; extend, don't duplicate. Before changing a symbol others use, grep its callers.
- Shared contract types/schemas live in `packages/shared` — import them, never redefine.
- i18n: your own namespace files `apps/web/messages/{ar,en}/<ns>.json`, registered in `apps/web/src/i18n/config.ts`.
  Arabic is default (RTL). Use logical CSS (ms/me/ps/pe/start/end), mirror directional icons.
- Tests by class: `logic` → unit + e2e/full-flow, ONE TEST PER PLANNED EDGE CASE, named after it; `ui` → component tests +
  a `@smoke` Playwright spec. Tests prove behavior, never appearance.
- Quiet tests: full output to `.logs/<name>.log`, read only the summary and failures.
- Run tests, `npm run lint`, `npm run typecheck` in the FOREGROUND; commit only when all pass. Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Update the business § file only if behavior differs from it — and say so in the report (don't silently change rules).
- Don't push, open PRs, merge, or touch `docs/BUILD_LOG.md`, the plan, or other tasks' files. No credentials anywhere.
- Write your report to `docs/build-log/waves/v1/<task>.md` (commit, built, test counts, edge cases ↔ test names, plan
  corrections) and commit it.
- Before reporting: stop every server, watcher and background loop you started; drop your agent DB.
- Report back in ≤10 lines: branch + commit(s), test summary lines, lint/typecheck, shared pieces created (paths), deviations.
