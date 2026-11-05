# fix-smoke2 — smoke failures after the fix/ui-screens + fix/ui-kit merge

Branch `fix/smoke-after-ui-fixes` (from dev @ `3efb4ac`). Fix commit `2e0cfb9`, then this report. Not pushed.
No schema or API change. Agent 5: API 3151 (`node dist`), web 3153 (`next dev`), DB `muayana_smoke2` (+ sample seed).

## Root causes (one line each)
1. **overlay-shift [desktop, ar+en]** — test bug: it measured `/settings/sites` while the list skeleton showed (probe: `<main>` 654px with `aria-busy` skeleton, 1857px 3s later); the list landing during the 300ms settle grew `<main>`, not the sheet. Spec now waits for the loaded list (and a page scrollbar) first.
2. **capture [mobile] site-chip disabled + auth [mobile] stuck on /capture** — the merged-run traces show the main `next dev` cold and contended (2 workers: login 7.8s, `/issues` 12.9s) with every `/api/proxy` read unanswered; the earlier abort fix (`9138a60`) is intact, nothing in the UI merges re-broke it. Reproduced on a cold own server (`rm -rf .next`, `--workers=2`): auth ran out of the 30s test budget mid-walk while routes compiled; the specs' own 60s waits could never fit in 30s → `test.setTimeout(90_000)` in both.
3. **Same class as fix-smoke #2, app bug** — the issues screen's reads (`useFilterOptions` ×3, `useIssuesList`, doubled by Strict Mode) and `usePagedList` (sites, workers) were never aborted on unmount; in the merged auth trace those 9 hung reads were what held Chrome's 6 connections when the Inbox navigation stalled. They now abort on unmount (and a superseded issues page request is aborted too).
4. **Web unit flake (pre-existing on base)** — `sort-card` "Changing category…" and `worker-view` "more than 100 issues…" take ~1s alone but >5s in a full parallel run; vitest `testTimeout` 15s.

## Tests
- New: `issues/_components/use-issues-reads.test.tsx` ("leaving the issues list aborts its pending filter-option requests…", "…aborts its pending page request"), `components/use-paged-list.test.tsx` ("leaving the list aborts its pending page request…") — all 3 fail on the old code.
- Web unit: 32 files / 200 tests pass (twice). Lint and typecheck pass.
- Smoke, own servers, no retries, after one warm run: **22 passed, 2 skipped** (overlay-shift is desktop-only) — twice in a row, both projects. Cold server, `--workers=2`, mobile auth + capture: 2 passed.
