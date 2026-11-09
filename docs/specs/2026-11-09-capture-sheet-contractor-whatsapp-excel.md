# Feature spec — one-sheet capture, «مقاول», WhatsApp photos, contractor Excel
Date: 2026-11-09 · Run mode: fully autonomous (feature mode) · Source: build log "Next up" (owner, 2026-11-09)
Owner answers in chat 2026-11-09: build everything here, including the capture sheet ("do all here" — the
unpushed `feat/capture-sheet` on the other PC is not used); the trade is picked first, then a contractor of
that trade.

## F1 — One sheet for the whole capture (business §5.1, §5.2)
After the photo(s) are taken, one bottom sheet holds everything for the new issue:
place (location), description, **trade** (category chips), **contractor** (only active contractors of
the chosen trade, with their open counts), priority. Saving creates the issue in one go:
- photo only → `new` (as today); trade + description → `unassigned`; + contractor → `assigned`.
- Works offline: the queue item carries the fields; trades and contractors come from the last list the
  phone saw (cached), marked "may be out of date" when offline. The server re-checks every rule at upload
  (archived site, inactive trade/contractor, contractor lacks the trade → the item is failed with the
  reason, never silently dropped; the photos are never lost — the engineer can retry without the
  contractor).
- The sheet opens with the keyboard down (no auto-focus), is usable at 360px, and "add another photo to
  this issue" stays available before saving.
- API: `POST /issues` (multipart) accepts optional `categoryId`, `workerId`, `priority` alongside
  `description`/`location`; the starting status follows the §4 rules via the shared `applyPatch` logic,
  and the history gets `none → new` plus one record for the move it lands on.

## F2 — "Worker" is «مقاول» in Arabic (all of §1–§8 wording)
Every Arabic label, sheet, message, empty state, error, WhatsApp text and CSV/Excel header says مقاول /
المقاولون / المقاول (plural and definite forms correct). English keeps "Worker". Data and API names
unchanged. Business doc: Arabic term noted in §2.

## F3 — WhatsApp sends the photos themselves (business §5.5, §6.10)
Single issue and batch: on a phone that can share files, the photo files go through the share sheet with
the text (site, #number, place, trade, description, priority) as the caption — **no photo links in the
text** in that case. The engineer picks the chat in WhatsApp (a file share cannot open a given number's
chat). Where file sharing isn't supported (most desktops) the fallback stays: wa.me link to the
contractor's chat with the text **and** photo links. Batch: all photos of the contractor's `assigned`
issues (up to the share limit the browser accepts; if the files are too many/too large, split into
several shares and say so). "Mark as sent?" unchanged (§6.13).

## F4 — Send a contractor's issues as an Excel file (business §5.5, §7)
On the contractor's page, "Send as Excel" builds an `.xlsx` of his issues (default: `assigned`; the
status filter of the page can widen it), with the columns picked by the **same column chooser and header
language as the Issues CSV export**, photos **embedded in the rows** (thumbnails, not links), RTL sheet
for Arabic. Shared through the share sheet to WhatsApp; fallback: download the file. Then "Mark as sent?"
for the included `assigned` issues (same rule as batch).
- Built on the phone (no server limit on response size; the API has a 4.5 MB response cap on Vercel):
  photos are downscaled to thumbnails (long side 320px, JPEG) before embedding; the file must stay under
  ~15 MB — beyond that, warn and offer fewer issues.
- Column definitions (keys, labels ar/en, value formatting) move to `packages/shared` so the CSV (API)
  and the Excel (web) use one list.

## Out of scope
Opening a specific WhatsApp chat with files attached (not possible from the web); WhatsApp Business API.
