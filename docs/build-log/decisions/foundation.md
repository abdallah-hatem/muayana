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
