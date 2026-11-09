# Build log
Run mode: fully autonomous — chosen by the user on 2026-11-05 (re-confirmed after the mockup: "go ahead, continue fully autonomous")
Goal (current): mobile-first web app for an audit engineer — capture defect photos on site, sort them into trade categories, assign to workers (no accounts), track statuses, worker views, CSV export of any filter · spec `docs/specs/2026-11-05-muayana.md` · plan `docs/superpowers/plans/2026-11-05-muayana-v1.md`
Current stage: **v1 live** — release PR #1 merged and deployed 2026-11-06 (muayana-web.vercel.app / muayana-api.vercel.app, Neon + Blob in Frankfurt). Post-v1 fixes shipped the same day (unused category colours, site switcher, 10-row pages). Capture redesign waiting on `feat/capture-sheet`.

## Final state (2026-11-05)
- All plan tasks T1–T12 merged into `dev`, plus fixes: smoke (abort hung reads on unmount, ×2), UI audit wave (kit + screens), re-audit polish, deploy readiness, DB-backed login lockout, seed photos through storage.
- Verified on `dev` (d3c1b94+): lint ✔ · typecheck ✔ · shared 49 · API 144 unit + 125 e2e (also with a 1-connection pool) · web 205 · Playwright smoke 22/22 mobile + desktop, no retries · whole-app UI audit → fixes → re-audit → polish · business-alignment release review (doc updated, no conflicts).
- Decisions worth reviewing first: [foundation decisions](build-log/decisions/foundation.md) (statuses incl. `new`/`cancelled`, WhatsApp via share sheet + "Mark as sent?", public unguessable photo URLs, design direction) and the GUESS rules in `docs/business/*.md`.

## Waiting on the user
- (`feat/capture-sheet` on the other PC is superseded by N1 — owner: "do all here".)
## Next up
Queued by the owner on 2026-11-09. **In progress** — spec `docs/specs/2026-11-09-capture-sheet-contractor-whatsapp-excel.md`, plan `docs/superpowers/plans/2026-11-09-next-up.md`, waves `build-log/waves/next-up/`. Owner 2026-11-09: build all here (unpushed `feat/capture-sheet` not used); trade first, then contractor.

1. **One sheet for the whole capture.** After taking the picture(s), the same sheet takes the
   place, the description **and the worker** it is assigned to, so an issue is captured and
   assigned in one go. Builds on the capture sheet on `feat/capture-sheet` (not merged yet).
   - Open point: does the sheet also pick the category (trade), or is it taken from the worker?

2. **"Worker" becomes «مقاول» in Arabic** everywhere in the app (nav, screens, sheets, messages,
   CSV headers). English stays "Worker" unless he says otherwise.

3. **WhatsApp: send the photos themselves, not a link.** The photo(s) go with the place and the
   description as text under them.
   - How: the phone's share sheet (Web Share API with files) sends the image files plus a caption to
     WhatsApp. He then picks the chat in WhatsApp: a share with files cannot open a given phone
     number's chat directly (only a text link can). iPhone Safari and Android Chrome support it;
     desktop browsers mostly don't, so keep the link message as the fallback there.
   - Today's message sends public photo links (business §6.10); update §5.5/§6.10 when this lands.

4. **Send a worker's issues as an Excel file on WhatsApp.** When a worker has several issues
   assigned, one action builds an .xlsx of them (number, place, description, status, due date…)
   and shares it to WhatsApp through the same share sheet.
   - Columns are picked the same way as the Issues page's CSV export (its column chooser), with
     the header language as there. The photos are embedded in the sheet (images in the rows, not
     links). Decided by the owner 2026-11-09.

## Blocked
- (none)
## Known follow-ups (not blocking)
- Unreached in audits: deactivated categories (no seed data), load-error/skeleton states, offline page on a production build.
- Vitest occasionally can't start a worker under heavy machine load on Windows (re-run passes; timeout raised to 15s).
## Phases
- Foundation — done · [decisions](build-log/decisions/foundation.md)
- v1 build — done · [waves](build-log/waves/v1/) · [agent rules](build-log/notes/agent-rules.md)

GitHub: `abdallah-hatem/muayana` (public), default branch `dev`; every commit and push as abdallah-hatem.
