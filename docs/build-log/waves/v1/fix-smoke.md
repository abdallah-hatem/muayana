# fix-smoke — capture sites stuck loading, nav stuck on /capture

Branch `fix/smoke-capture-nav` (fast-forwarded to `dev` @ `9fb2ff4` first: the worktree started at the
stale `0a77478`). Fix commit `9138a60`, then this report. Not pushed, not merged. No schema or API change.

## What the failing run showed
The merged-dev traces (`apps/web/test-results` in the main checkout, 18:38–18:40) show every
`/api/proxy/*` request and the `/capture` RSC payload **never answering** (status -1), while the main
`next dev` server was rebuilding over and over right after the T7 merge + `npm install` (login 5s,
`/capture` 13s, "[Fast Refresh] rebuilding" throughout). `archived=false&limit=100` is valid for the
sites DTO and the envelope is a plain list — neither was the cause. On clean servers (agent 8, dev and
`next start`) and on the main servers now, auth + capture pass. The app defects that turned a stalled
server into a stuck screen:

## Root causes (one line each)
1. **Capture stuck on "loading sites…"**: `useCaptureSites` had no failure path for a request that never answers or throws (no timeout, no `.catch`, `res.data.filter` unguarded), so it stayed `loading` forever.
2. **Inbox click not navigating from /capture**: pending reads were never aborted on unmount (the dashboard's, the site switcher's and capture's, doubled by Strict Mode), so hung requests filled Chrome's 6 connections per origin and the next page's RSC request queued behind them.

## Fix
- `apps/web/src/lib/api-client.ts`: reads (GET/HEAD) fail as `NETWORK_FAILURE` after `READ_TIMEOUT_MS`
  (15s) and honour the caller's `signal`; writes get no timeout (slow uploads, and the offline queue must
  not resend a write the server may have applied).
- `use-capture-sites.ts`: reuses `listActiveSites(signal)` (was a duplicate path), catches any throw or
  non-list answer into the failed state, aborts on unmount.
- `site-switcher.tsx`, `dashboard-screen.tsx`: abort their request on unmount.

## Tests
- `src/lib/api-client.test.ts`: "a read that never answers fails as a network error after the read
  timeout", "aborting the caller's signal releases a pending read at once", "a write has no read timeout".
- `src/app/(app)/capture/use-capture-sites.test.tsx`: "a sites request that throws ends in the failed
  state, never stuck loading", "an answer that is not a list ends in the failed state…", "leaving capture
  aborts its pending sites request…" (all fail on the old code), plus the happy path.
- Web unit: 22 files / 146 tests pass. Lint and typecheck pass.
- Smoke (own servers, API 3181 / web 3183 `next dev`, DB `muayana_fixsmoke`): **16 passed** on mobile +
  desktop — issues-dashboard included, since T7 is now on dev.

## Notes
- `sort-card.test.tsx` ("Changing category in the sorter…", "a full sort with a worker…") sometimes hits
  the 5s test timeout in a full parallel run under load (also on the unchanged base); ~0.8s alone. Not touched.
- In `next dev`, a route's first compile can exceed the nav walk's 5s `toHaveURL` default (seen once on a
  cold server); warm or `next start` it passes. Test left as is.
