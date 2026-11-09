# Build log
Run mode: fully autonomous — chosen by the user on 2026-11-05 (re-confirmed after the mockup: "go ahead, continue fully autonomous")
Goal (current): mobile-first web app for an audit engineer — capture defect photos on site, sort them into trade categories, assign to workers (no accounts), track statuses, worker views, CSV export of any filter · spec `docs/specs/2026-11-05-muayana.md` · plan `docs/superpowers/plans/2026-11-05-muayana-v1.md`
Current stage: **released 2026-11-09** — PR #2 (one-sheet capture, «مقاول», WhatsApp photo files, contractor Excel) merged to `production` (238df45); Vercel builds for muayana-api and muayana-web succeeded; read-only production checks pass (API health 200, login 200, signed-out redirects/401). No migration in this release.

## Final state (2026-11-05)
- All plan tasks T1–T12 merged into `dev`, plus fixes: smoke (abort hung reads on unmount, ×2), UI audit wave (kit + screens), re-audit polish, deploy readiness, DB-backed login lockout, seed photos through storage.
- Verified on `dev` (d3c1b94+): lint ✔ · typecheck ✔ · shared 49 · API 144 unit + 125 e2e (also with a 1-connection pool) · web 205 · Playwright smoke 22/22 mobile + desktop, no retries · whole-app UI audit → fixes → re-audit → polish · business-alignment release review (doc updated, no conflicts).
- Decisions worth reviewing first: [foundation decisions](build-log/decisions/foundation.md) (statuses incl. `new`/`cancelled`, WhatsApp via share sheet + "Mark as sent?", public unguessable photo URLs, design direction) and the GUESS rules in `docs/business/*.md`.

## Waiting on the user
- **Release permanent delete** (on dev, verified): it adds migration `20261109140131_issue_former_worker_name`. Before merging dev → production, run `npx prisma migrate deploy` from apps/api against the production **unpooled** Neon URL (docs/DEPLOY.md), then merge the release PR. Owner runs the migration on the other PC (2026-11-09); release PR #3 is open — merge only after he confirms.
- `feat/capture-sheet` on the other PC is superseded by N1 (owner: "do all here") — don't merge it.
## Next up
- (none queued) — the 2026-11-09 batch is built: N1 one-sheet capture (trade → contractor), N2 «مقاول», N3 WhatsApp photo files, N4 contractor Excel with embedded photos, plus on-demand photo loading for sends and the UI-audit fixes. Spec `docs/specs/2026-11-09-capture-sheet-contractor-whatsapp-excel.md`, waves `build-log/waves/next-up/`.

## Blocked
- (none)
## Known follow-ups (not blocking)
- Unreached in audits: deactivated categories (no seed data), load-error/skeleton states, offline page on a production build.
- Vitest occasionally can't start a worker under heavy machine load on Windows (re-run passes; timeout raised to 15s).
## Phases
- Foundation — done · [decisions](build-log/decisions/foundation.md)
- v1 build — done · [waves](build-log/waves/v1/) · [agent rules](build-log/notes/agent-rules.md)

GitHub: `abdallah-hatem/muayana` (public), default branch `dev`; every commit and push as abdallah-hatem.
