# Build log
Run mode: fully autonomous — chosen by the user on 2026-11-05 (re-confirmed after the mockup: "go ahead, continue fully autonomous")
Goal (current): mobile-first web app for an audit engineer — capture defect photos on site, sort them into trade categories, assign to workers (no accounts), track statuses, worker views, CSV export of any filter · spec `docs/specs/2026-11-05-muayana.md` · plan `docs/superpowers/plans/2026-11-05-muayana-v1.md`
Current stage: **released 2026-11-10** — PR #6 (N5 photos from the gallery: one issue each or one issue with all, "From gallery" in the capture sheet, file-dated capture time, gallery allowed for solve photos) merged to `production` (eacf5c8), muayana-api and muayana-web Ready, health OK, signed-out 401/redirect checked. Verified before release: lint, typecheck, web 293, smoke 30/30 on a production build, alignment review ALIGNED after a §3 doc fix. Earlier: PR #5 dashboard heading, PR #4 install card + keyboard-down sheets, PR #3 permanent delete, PR #2 one-sheet capture (2026-11-09).

## Final state (2026-11-05)
- All plan tasks T1–T12 merged into `dev`, plus fixes: smoke (abort hung reads on unmount, ×2), UI audit wave (kit + screens), re-audit polish, deploy readiness, DB-backed login lockout, seed photos through storage.
- Verified on `dev` (d3c1b94+): lint ✔ · typecheck ✔ · shared 49 · API 144 unit + 125 e2e (also with a 1-connection pool) · web 205 · Playwright smoke 22/22 mobile + desktop, no retries · whole-app UI audit → fixes → re-audit → polish · business-alignment release review (doc updated, no conflicts).
- Decisions worth reviewing first: [foundation decisions](build-log/decisions/foundation.md) (statuses incl. `new`/`cancelled`, WhatsApp via share sheet + "Mark as sent?", public unguessable photo URLs, design direction) and the GUESS rules in `docs/business/*.md`.

## Waiting on the user
- **Pick the N6 tray design** — mockups A (tray behind the camera button), B (tab in the Inbox), C (group everything, save all): https://claude.ai/artifact/L8BUPzfqD3KTNDhTmHAnwh (2026-11-21).
## Next up
- **N6 — unsorted photos tray** (asked 2026-11-21; mockups A/B/C published, waiting on his pick): import as many gallery
  photos as he wants into a holding area ("unassigned images") that is not an issue yet. At any time he
  opens it, selects some photos and makes one issue from them (e.g. 5 imported → 3 into one issue, 1
  into another, 1 into a third); made-into-issue photos leave the tray. Builds on N5 (§5.1 step 5).
  - Open points: where the tray lives (nav, capture screen, inbox); per site or across sites; works
    offline (photos kept on the phone) or uploaded first; can a tray photo be deleted/added to an
    existing issue.

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
