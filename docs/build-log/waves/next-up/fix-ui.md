# Fix — next-up UI audit findings

Branch `fix/nextup-polish` (from `dev`), commit `0aab40a`. Source: `ui-audit.md` (this folder).

## What changed, per finding

| # | Finding | Fix |
|---|---|---|
| 1 major | Column chooser: only the 20px box and 14px text took a tap | `ColumnCheckbox` is now one `<Label htmlFor>` row (`min-h-11`) wrapping the checkbox and its text: a tap anywhere on the 44px row toggles; the checkbox gets its name from the label; Tab + Space work. Same component in the Issues export dialog and the Excel sheet. |
| 2 | Excel chooser offered "Photo links" | Shared `exportColumnLabel(key, lang, target)` + `ExportTarget = 'csv' \| 'excel'` in `packages/shared/src/rules/issue-export.ts` (uses the defs' existing `pictureLabel`). `ExportColumnChooser target="excel"` shows «الصور» / "Photos" and «صور بعد الإصلاح» / "After photos"; the CSV keeps the link names. `excelSlots` uses the same helper, so the chooser and the file headers can't drift. |
| 3 | "Cancelled" chip had no count | `WorkerCountsSchema` gains `cancelled` (API `toWorker` fills it from the tally). The chip now reads «ملغي 0». The contractor-page delete check's fallback count includes cancelled issues too. |
| 4 | Arabic plurals | ICU `two/few/many` added: `send.batch.button`, `send.batch.confirmBody`, `send.batch.part` (`total`), `send.parts.hint` (`parts`), `send.prepare.button` (`many`), `excel.tooBig` (`total`), and `inbox.bulk.categoryDone` (same mistake, older namespace). 2 → «ملاحظتين»; 11 → «11 ملاحظة». |
| 5 | Contractor page site chip: pin only at 360 | It was by design (the label hides below a set container width) but the cut-off was too early: "Workers" + the queue chip left about 113px, under the threshold. Now the chevron hides first (container under 8rem), and the name hides only under 4.5rem. Measured: the name shows with an ellipsis down to about 300px wide (for example «Smoke…» at 320), so it matches the issue page. |
| 6 nit | Cancel vs Not yet | `ConfirmSheet` gains an optional `cancelLabel`. The Excel "Mark as sent?" sheet now uses `excel.confirm.no` = «ليس بعد» / "Not yet", the same as the WhatsApp send flow. |
| 7 nit | Arabic-Indic digits | `excel.tooBig` uses «15 ميجابايت»; the fixed limits in `capture` and `issue` (10 photos, 4 MB) are Latin too. I left the example placeholders («الدور ٣ – شقة ٧») unchanged because they show what a person types. |
| 8 nit | No scroll cue in sheets | `BottomSheet` draws a bottom fade (`from-background`) only while content sits below the fold. It re-checks on scroll, on resize and when content changes, and it's gone at the end. This applies to every bottom sheet. |
| 9 nit | Textarea resize grip | `resize-none` on the shared `Textarea` (it already auto-grows with `field-sizing-content`). |
| 10 nit | Two site pickers on capture | The top-bar switcher shows on /capture at every size, so the camera-panel chip is gone. The capture site drawer stays as the prompt when the shutter is pressed with no site chosen. I removed the unused `capture.site.{label,choose,loading}` keys. |

## Tests
- Component: `export-column-chooser.test.tsx` covers 4 cases: a row tap outside the box toggles, the box toggles once, keyboard Space toggles the named checkbox, and Excel names photo columns as pictures while the CSV keeps links (ar and en).
- Plurals: `i18n/messages.test.ts` "Arabic plurals" has 11 cases (2 / 3 / 11 for batch button, confirm body, parts hint, tooBig, inbox).
- `send-excel.test.tsx` has a new test: every status chip shows its count, Cancelled included. The existing tests now click "Not yet".
- Shared: `exportColumnLabel` test. API: `workers.pure.spec` and `workers.e2e-spec` (15/15) now count `cancelled`.
- Web unit: 274 passed (42 files). Shared: 61 passed. API unit: 147 passed. Lint 0 errors (3 pre-existing warnings). Typecheck clean.
- Smoke on my servers (API 3121, web 3123, DB `muayana_nextuppolish` with sample seed): contractor-excel, issues-dashboard, capture, and sort-issue-send all passed, 16 tests in total (mobile + desktop). `capture.spec` now picks the site in the top-bar switcher.
  Note: the API must run with `PUBLIC_UPLOAD_BASE_URL` set to its own port. The copied `.env` points at 3101, and with that the photo specs fail.

## Screenshots looked at
360×780 and 1440×900 × ar/en × light/dark: Excel sheet (open, scrolled), Excel "Mark as sent?", capture page, capture sheet, worker header, plus the header at 320/290/260. The measurements in the same run were the same in all 8 variants:
- Clicking the row's far corner toggles it.
- The fade shows while there is more below, and is gone at the end.
- The photo columns read «الصور» / "Photos".
- The Cancelled chip shows 0.
- The buttons read Not yet / ليس بعد.
- No `site-chip` on /capture.
- The textarea has `resize: none`.
