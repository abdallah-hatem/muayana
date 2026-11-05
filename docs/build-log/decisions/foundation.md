# Decisions — foundation (stages 1–5)

- **[Run mode]** Fully autonomous — chosen by the user on 2026-11-05.
- **[Skills]** Fetched latest `abdallah-skills` (1.53.0 → 1.60.2) before starting, at the user's request.
- **[Stage 1] Users** — one engineer account. User's pick. Alternatives: team with shared data; multi-tenant.
- **[Stage 1] Sites** — issues belong to a site + free-text location. User's pick. Alternatives: structured floor/unit tree; single building.
- **[Stage 1] Offline** — offline capture queue, installable PWA. User's pick. Alternative: online only.
- **[Stage 1] Name** — "Muayana / معاينة" (inspection), repo `muayana`. Why: short, Arabic, says what it does. Alternatives: "Snag", "Site Audit".
- **[Stage 1] Stack** — same as Prime Property: NestJS + Prisma API, Next.js + Tailwind + shadcn web, shared zod package, Postgres (Neon), Vercel. Why: user asked for "like Prime Property"; one stack to maintain.
- **[Stage 1] Photo storage** — one storage interface; `local` disk in dev/test, Vercel Blob when deployed; photos compressed on the phone to ≤1600px JPEG before upload (keeps uploads under Vercel's 4.5 MB body limit and fast on site). Alternatives: direct client uploads to Blob (more moving parts offline).
- **[Stage 1] Languages** — Arabic default (RTL) + English. Why: Arabic trade names, Egyptian user. 
- **[Stage 2] Statuses** — `new` (captured, unsorted) added before `unassigned` so sorting is a visible step; `cancelled` added for non-issues/duplicates. Skipping forward and moving back allowed (except to `new`). Why: the engineer controls statuses himself and real work skips steps. Alternatives: strict linear order.
- **[Stage 2] WhatsApp** — Web Share (photos + text) with `wa.me` fallback, then "Mark as sent?" confirmation. Why: no WhatsApp Business API account/cost; the engineer stays in control. Alternative: Business API (paid, out of scope).
- **[Stage 2] Overdue** — computed flag (estimate date passed, not solved/cancelled), not a status.
- **[Stage 2] Spec + business doc approved** autonomously against the goal.
- **[Stage 4] Design direction "Site tape"** — safety yellow on ink, concrete-paper light / graphite dark, Readex Pro (heavy) + IBM Plex Mono numbers, stamped status chips, centre capture shutter. Why: bold, sunlight-legible, fits construction sites; avoids the generic SaaS look. Alternatives: calm blueprint-blue engineering look; neutral minimal. The user asked to see a mockup first (2026-11-05) — six phone screens shown (`docs/design/mockup.html`), then "continue fully autonomous".
- **[Stage 5] Alignment review on plan → CONFLICTS / DOC OUT OF DATE.** Fixed: T9, T11, T12 reclassified to logic with edge cases; ~30 missing edge cases added (§6.1 clears, §6.4 clear date, after-photo cap, history rows on bulk/reopen, sorts and date ranges, login recovery, no sign-up); contract errors aligned to 409 ARCHIVED_SITE / INACTIVE_CATEGORY; doc: photo files are the one exception to §6.10 (unguessable links for WhatsApp), archived sites left out of the dashboard (§5.9, GUESS).
