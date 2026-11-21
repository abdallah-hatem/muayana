# Build log
Run mode: fully autonomous — chosen by the user on 2026-11-05 (re-confirmed after the mockup: "go ahead, continue fully autonomous")
Goal (current): mobile-first web app for an audit engineer — capture defect photos on site, sort them into trade categories, assign to workers (no accounts), track statuses, worker views, CSV export of any filter · spec `docs/specs/2026-11-05-muayana.md` · plan `docs/superpowers/plans/2026-11-05-muayana-v1.md`
Current stage: **released 2026-11-21** — PR #7 (N6 unsorted photos tray «صور غير مرتبة», design A; capture sheet numbers photos in pick order) merged to `production` (a3faf2a); muayana-api and muayana-web Ready, health OK, live sign-in and /capture/tray checked. Verified before release: typecheck, lint, web 333, Playwright N6 spec mobile + desktop. Earlier: PR #6 gallery import (N5), #5 heading, #4 install card + keyboard-down sheets, #3 permanent delete, #2 one-sheet capture.

## Final state (2026-11-05)
- All plan tasks T1–T12 merged into `dev`, plus fixes: smoke (abort hung reads on unmount, ×2), UI audit wave (kit + screens), re-audit polish, deploy readiness, DB-backed login lockout, seed photos through storage.
- Verified on `dev` (d3c1b94+): lint ✔ · typecheck ✔ · shared 49 · API 144 unit + 125 e2e (also with a 1-connection pool) · web 205 · Playwright smoke 22/22 mobile + desktop, no retries · whole-app UI audit → fixes → re-audit → polish · business-alignment release review (doc updated, no conflicts).
- Decisions worth reviewing first: [foundation decisions](build-log/decisions/foundation.md) (statuses incl. `new`/`cancelled`, WhatsApp via share sheet + "Mark as sent?", public unguessable photo URLs, design direction) and the GUESS rules in `docs/business/*.md`.

## Waiting on the user
- (none)
## Next up
- (none)

## Blocked
- (none)
## Known follow-ups (not blocking)
- Unreached in audits: deactivated categories (no seed data), load-error/skeleton states, offline page on a production build.
- Local smoke runs fill the local DB with test trades (100-category cap) and can trip the sign-in limit; clear unused test categories and `login_failures` before a long smoke run.
- Vitest occasionally can't start a worker under heavy machine load on Windows (re-run passes; timeout raised to 15s).
## Phases
- Foundation — done · [decisions](build-log/decisions/foundation.md)
- v1 build — done · [waves](build-log/waves/v1/) · [agent rules](build-log/notes/agent-rules.md)

GitHub: `abdallah-hatem/muayana` (public), default branch `dev`; every commit and push as abdallah-hatem.
