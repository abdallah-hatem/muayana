# send-prefetch — photos downloaded only when a send starts

Branch `fix/send-prefetch` (from dev), commit `2a0f72f`. Class: ui (frontend only).

## Built
- `components/send/use-prepared-photos.ts` (new, replaces `usePhotoFiles`): nothing is fetched on mount. `start()`
  downloads the issues' before-photos (one `AbortController`, `done`/`total` counted per settled photo);
  `cancel()` aborts every download and returns to idle; new issues/photos (the next batch) or unmount abort too.
  Once `ready`, `items` is held in state, so the share runs synchronously from the tap (no await before
  `navigator.share`). No file sharing, or no photos → `ready` at once (wa.me fallback unchanged, no extra tap).
- `send-flow.tsx`: optional `prepare` prop — "Prepare N photos to send" → disabled "Preparing photos n of m…"
  with a progressbar and Cancel → the usual "Send … on WhatsApp" label. Multi-part shares, missing-photo caption,
  AbortError → nothing, wa.me fallback, "Mark as sent?" all unchanged. Same rule for single-issue `SendToWorker`.
- `lib/whatsapp-share.ts` `loadIssuePhotos(issue, urls, { signal, onPhoto })`.
- Dedupe: `lib/share-cancel.ts` `isShareCancel` used by `share-file.ts` and `whatsapp-share.ts`.
- i18n `send.prepare.{button,progress,label,cancel,hint}` (ar/en).
- Business §5.5: one sentence added (photos downloaded only when a send starts) — behavior change from N3.

## Edge cases ↔ tests (`components/send/send-photos.test.tsx`)
- Contractor page open → no photo is fetched until the engineer taps (batch and single)
- Tap "Prepare photos" → the photos are fetched with an n-of-m progress, then the button shares
- Share after the photos are ready → navigator.share is called inside the click handler (user activation)
- Cancel while preparing → every photo download is aborted and nothing more is fetched
- Existing N3 send tests now tap Prepare first; `@smoke` "photo goes as a file" also asserts no photo fetch
  before the tap and exactly one after.

## Checks
web 246/246 (40 files); lint 0 errors (3 pre-existing warnings); typecheck clean.
Smoke on own servers (API 3151, web 3153, DB `muayana_sendtidy`): sort-issue-send + workers + contractor-excel
12/12 (mobile + desktop).

## Notes
- On a phone that can share files, sending now takes one more tap (prepare, then share) — the price of not
  spending mobile data on page open. Issues without photos and the wa.me fallback still send in one tap.
- Not checked visually in a browser at 360px; the new UI reuses the existing button, hint and token classes.
