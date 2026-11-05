# Waves — v1
- Wave 1: T1 alone — every task depends on the scaffold.
- Wave 2: T2 ‖ T3 in parallel — T4–T12 all need T2's auth guard/shell; T6/T10/T11 also need T3.
- T3 merged (62f3a3b) · 46 shared tests.
- T2 merged (c912a69) · api 62 unit + 23 e2e, web 24, smoke 4. Merged dev green: lint, typecheck, tests.
- Wave 3: T4+T5 (batched, both small backend CRUD) ‖ T6 ‖ T10 ‖ T11 ‖ T12 — 5 agents · T7 waits on T5+T6 · T8, T9 wait for a free slot (cap 5) · frontend smoke runs on the merged result
- T11 merged (fd513d3) · web 55 tests · smoke specs pending APIs. Wave 3b: T8+T9 batched into the freed slot (both CRUD screens; T9 mounts BatchSendToWorker from T11).
- T6 (5dd521a), T4+T5, T12 merged (d24c15e) — app.module + i18n config conflicts were additive, resolved by keeping both. Wave 4: T7 alone (needs T5+T6) · T8+T9 and T10 still running.
- T10 merged (fc493b6) after resolving shell/top-bar/i18n conflicts in its worktree (kept both: SiteProvider + QueueSheetProvider; SiteSwitcher + QueueChip); capture now uses the shared last-site key. Merged dev: shared 46, api 121, web 125(+T10) tests, lint, typecheck green.
