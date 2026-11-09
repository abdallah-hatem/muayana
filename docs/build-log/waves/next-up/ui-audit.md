FINDINGS

# UI audit — next-up batch (N1 capture sheet, N2 «مقاول», N3 WhatsApp photos, N4 contractor Excel)
Date 2026-11-09 · production build at http://localhost:3100 (API :3101), seeded data · Playwright (Chromium), service
worker blocked, every mutating `/api/proxy` request aborted (nothing created, nothing marked sent; the capture
drafts stayed in throwaway browser contexts) · `navigator.share`/`canShare` mocked (≤1 file per share → forces
"Share part k of n"); photo downloads slowed 2.5 s to catch the progress state.
Matrix: 360×780 (mobile, DPR 2) and 1440×900 × light/dark × ar/en = 8 variants. Driver: `.logs/ui-audit-nextup/audit.cjs`,
raw measurements: `.logs/ui-audit-nextup/results.json`. Screenshots: `.logs/ui-audit-nextup/shots/`
(`<screen>__<state>__<size>-<rtl|ltr>-<light|dark>.png`).

## Findings (most severe first)

| # | Screen | State | Size · theme · lang | Finding | Severity | Likely file | Screenshot |
|---|---|---|---|---|---|---|---|
| 1 | Contractor page → Send as Excel sheet (also the Issues export dialog, same component) | open / scrolled | all 8 | Column chooser rows: the row is `min-h-11`, but only the 20×20 checkbox and the 14px-tall label line respond to a tap (measured: checkbox 20×20, label 280×14 at 360). The rest of the 44px row is dead, so the real target is ~20px tall: 19 rows of near-misses on a phone. | major | `apps/web/src/components/export-column-chooser.tsx` (`ColumnCheckbox`: make the whole row the label/target) | `.logs/ui-audit-nextup/shots/excel-sheet__open__360-rtl-light.png` |
| 2 | Send as Excel sheet | open / scrolled | all | The column chooser still says «روابط الصور» / «روابط صور بعد الإصلاح» ("Photo links" / "After-photo links"), but in the Excel those columns become embedded pictures (header «الصور»). The label promises links the file won't have. | minor | `send-excel.tsx` / `export-column-chooser.tsx` (use the def's `pictureLabel` in the Excel context) | `.logs/ui-audit-nextup/shots/excel-sheet__scrolled__360-rtl-light.png` |
| 3 | Send as Excel sheet | status chips | all | Every status chip has a count except «ملغي» / "Cancelled", which has none (worker `counts` has no `cancelled`). It reads as broken next to "Sent 0". | minor | `app/(app)/workers/[id]/send-excel.tsx` (`StatusPicker`/`countOf`) | `.logs/ui-audit-nextup/shots/excel-sheet__no-status__360-ltr-light.png` |
| 4 | Contractor page | batch button | ar · any | Arabic plural in `send.batch.button` is `other {إرسال # ملاحظات مُسندة…}`. This gives «إرسال 2 ملاحظات» (should be «ملاحظتين») and «11 ملاحظات» (should be «ملاحظة»). `confirmBody` «كل الـ # ملاحظات» has the same problem. Seed only reaches count 1, so it isn't on screen here; read from the locale file. | minor | `apps/web/messages/ar/send.json` (add `two`/`few`/`many`, as `excel.json` does) | (string, `apps/web/messages/ar/send.json`) |
| 5 | Contractor page | header | 360 · both themes · ar+en | The header site chip shows only the pin and the chevron, with no site name. The title «المقاولون»/"Workers" squeezes the name to zero width (the issue page shows «برج النخيل -…»). Probably from before this batch (shell). | minor | app shell header / site chip | `.logs/ui-audit-nextup/shots/worker__batch-progress__360-ltr-light.png` |
| 6 | Mark-as-sent sheets | open | all | The two "Mark as sent?" sheets use different secondary buttons: WhatsApp has "Not yet" / «ليس بعد», the Excel sheet has "Cancel". It's the same question, so it should have the same answers. | nit | `send-excel.tsx` (`ConfirmSheet`) vs `components/send/send-flow.tsx` | `.logs/ui-audit-nextup/shots/excel-sheet__mark-as-sent__360-ltr-light.png` |
| 7 | Excel sheet | too-big warning text | ar | `excel.tooBig` writes «حوالي ١٥ ميجابايت» in Arabic-Indic digits, while the same sheet shows «0.1 ميجابايت» and counts in Latin digits (DESIGN: numbers in Latin mono). | nit | `apps/web/messages/ar/excel.json` | (string; warning state not reached) |
| 8 | Capture sheet | open | all | The body scrolls with no cue: at 360 the trade chips are cut flat at the footer edge, and Contractor and Priority sit below the fold behind every trade. There is no fade or shadow to show more content below. | nit | `components/bottom-sheet.tsx` / `capture-sheet.tsx` | `.logs/ui-audit-nextup/shots/capture-sheet__open__360-rtl-light.png` |
| 9 | Capture sheet | description | all | The textarea shows the browser's default resize grip in the corner, which looks like a library default and not like the "site tape" style. | nit | `components/ui/textarea.tsx` / `capture-sheet.tsx` | `.logs/ui-audit-nextup/shots/capture-sheet__open__360-ltr-dark.png` |
| 10 | Capture page | page | all | There are two site pickers on one screen (header chip and camera-panel chip), both showing the same site. Probably from before this batch. | nit | `capture-screen.tsx` / shell | `.logs/ui-audit-nextup/shots/capture__page__360-ltr-light.png` |

## Checked and passing
- **Keyboard down (N1):** on open, focus is on the sheet `DIV[role=dialog]`, never an input, in all 8 variants. A blocked save (contractor, no description) focuses `#capture-description` and shows the error.
- **Layout shift:** I measured the header, h1, nav and every fixed/sticky element before and while each overlay was open: capture sheet, contractor select, issue mark-as-sent, batch mark-as-sent, Excel sheet, Excel mark-as-sent. 0 px difference in every variant, LTR and RTL.
- **Sheets vs bottom nav:** every sheet's bottom equals the viewport bottom (780/900) and draws over the nav (nav at y706, z40). The sheet footers are fully visible.
- **No horizontal overflow** on /capture, /issues/[id], /workers/[id] at 360 (ar+en). The only off-screen boxes are carousel slides.
- **No untranslated keys** (namespace.key scan) on any captured screen or sheet.
- **N2 wording:** no «عامل/عمال» in any UI string on /, /inbox, /issues, /workers, /workers/new, /settings, /settings/categories, /settings/sites, the capture sheet, the issue page, the contractor page or the Excel sheet. «أُرسل للمقاول», «المقاول», «بدون مقاول», «حدّد الموعد الذي قاله المقاول» all read correctly. The only hits are test data: categories «صنعة عمال NNNN» created by `apps/web/e2e/workers.spec.ts` (fixture name, not UI).
- **N3:** "Prepare 2 photos" → progress with Cancel → Cancel returns to idle → "Send on WhatsApp" → "Share part 2 of 2" plus hint → "Mark as sent?". The mocked shares got `#9-1.jpg` then `#9-2.jpg`, 1 file each, with no URLs in the caption. Same flow for the batch on the contractor page.
- **N4:** status chips (default `assigned`), "choose at least one status" error with Prepare disabled, file ready (`كريم السباك-2026-11-09.xlsx`, 0.1 MB) shared as 1 file, then "Mark as sent?". The 2-column chooser at 1440 mirrors correctly in RTL.
- **Direction:** back arrows, chevrons, chip order, segmented priority and select check marks mirror correctly in ar. In en, an Arabic name inside an LTR option («كريم السباك 3 open») stays readable.

## Coverage
Reached: capture page, site picker, capture sheet (open, 2 photos, trade picked/scrolled, contractor list + hover, blocked save, offline "may be out of date"), issue page (page, prepare, progress, ready, share part 2/2, mark-as-sent), contractor page (page, batch prepare/progress/cancelled/ready/share-part/mark-as-sent), Excel sheet (open, scrolled, no status, ready, mark-as-sent). Wording scan of 8 other routes (ar, both sizes, light).

Not reached:
- Excel "too big" (>15 MB) warning and "include the first N" button: seed files are 0.1 MB.
- Excel "reading…" and "photos n of m" progress: too fast to capture.
- Excel/bulk refusal and "partly" errors; mark-as-sent API error. I didn't send any status change.
- Capture upload refused (409) → "Retry without the worker": needs a server refusal, and creating issues was avoided.
- wa.me fallback (no file sharing): share was mocked as available everywhere.
- Batch >200 "part k of n" hint, and batch plurals for 2/11+ (seed has 1 assigned per contractor).
- Real on-screen keyboard: checked as focus target only.

Count: screens 3/3 changed + 8 wording routes · states 26/32 · screenshots 232 taken, 30 opened and looked at (one or more of each state, spread across sizes, themes and languages). The rest were checked through the per-variant measurements in `results.json`.

## Teardown
Nothing started or stopped: the running production web/API were used as-is. Playwright browsers closed. Only files written: `.logs/ui-audit-nextup/` and this report.
