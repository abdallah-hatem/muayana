# Muayana — API contract
Date: 2026-11-05. Base path `/api/v1`. Every response uses the house envelope
(`{ success, message, statusCode, data, error?, timestamp, path, meta? }`); lists put pagination in
`meta` (`total, page, limit, hasNextPage, hasPreviousPage`), default `limit` 20, max 100 (the issues list
needs larger pages on desktop; the cap is 100). CSV endpoints are the only routes outside the
envelope: they stream `text/csv; charset=utf-8` with a BOM.

Shapes are zod schemas in `packages/shared/src/schemas/*` and inferred types in `packages/shared/src/types`;
the API DTOs mirror them with class-validator. Ids are UUIDs (issues: client-generated UUID v4).
Dates are ISO strings; `estimatedDate` is a date-only `YYYY-MM-DD`.

Auth: `Authorization: Bearer <access token>` (JWT, 7 days) — the web keeps it in an httpOnly cookie set by
a Next.js route handler and forwards it (same pattern as Prime). Photo files are served from public
unguessable URLs (Blob) or `/uploads/*` locally.

## Enums
- `IssueStatus`: `new | unassigned | assigned | sent | estimated | in_progress | solved | cancelled`
- `Priority`: `low | normal | high | urgent`
- `PhotoKind`: `before | after`

## Auth
| Method | Path | Body | Data |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ accessToken, user: { id, email, name, locale } }` · 401 wrong creds · 429 rate-limited |
| GET | `/auth/me` | — | `{ id, email, name, locale }` |
| PATCH | `/auth/me` | `{ name?, locale? ('ar'\|'en') }` | user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword (≥8) }` | `{ ok: true }` · 400 wrong current |

## Sites
| Method | Path | Body / query | Data |
|---|---|---|---|
| GET | `/sites` | `?archived=false\|true\|all&search&page&limit` | `Site[]` + meta. `Site = { id, name, address, notes, archived, createdAt, nextNumber, counts: { open, new, overdue, total } }` |
| POST | `/sites` | `{ name (1–120), address? (≤240), notes? (≤2000) }` | Site · 409 duplicate name |
| GET | `/sites/:id` | — | Site |
| PATCH | `/sites/:id` | partial create + `archived?` | Site · 409 duplicate |
| DELETE | `/sites/:id` | — | `{ id }` · 409 has issues |

## Categories
| Method | Path | Body / query | Data |
|---|---|---|---|
| GET | `/categories` | `?active=true\|all` | `Category[]` (not paginated — small, bounded; max 100). `Category = { id, nameAr, nameEn, color, sortOrder, active, counts: { open, workers } }` |
| POST | `/categories` | `{ nameAr (1–60), nameEn? (≤60), color (#RRGGBB) }` | Category · 409 duplicate |
| PATCH | `/categories/:id` | partial + `active?` | Category |
| PUT | `/categories/order` | `{ ids: uuid[] }` (all ids) | `Category[]` |
| DELETE | `/categories/:id` | — | `{ id }` · 409 in use |

## Workers
| Method | Path | Body / query | Data |
|---|---|---|---|
| GET | `/workers` | `?search&categoryId&active=true\|false\|all&page&limit` | `Worker[]` + meta. `Worker = { id, name, phone, notes, active, categories: CategoryRef[], counts: { assigned, sent, estimated, in_progress, solved, open, overdue } }` |
| GET | `/workers/:id` | — | Worker |
| POST | `/workers` | `{ name (1–120), phone, categoryIds (≥1), notes? }` | Worker · 400 bad phone · 409 INACTIVE_CATEGORY · 409 duplicate phone |
| PATCH | `/workers/:id` | partial + `active?` | Worker |
| DELETE | `/workers/:id` | `?issues=keep\|delete` (needed only when he has issues) | `{ id }` — permanent (business §3). No issues → deleted. Has issues and no `issues` → 409 WORKER_HAS_ISSUES, `data: { open, solved, cancelled, total, photos }`, nothing changes. `keep`: open issues (assigned/sent/estimated/in_progress) → `unassigned`, estimate cleared, one history row each with a note naming him; solved/cancelled keep their status, lose the worker and get `formerWorkerName`. `delete`: every issue he has, with photos and history. Then the worker and his category links. One transaction; photo files removed after commit, best-effort · 400 bad `issues` · 404 |
| GET | `/workers/export.csv` | same filters as list | CSV |

## Issues
`Issue = { id, siteId, site: { id, name }, number, status, priority, description, location, category: CategoryRef|null, worker: { id, name, phone }|null, formerWorkerName: string|null (a deleted contractor's name kept on the issue — shown marked "deleted"), estimatedDate, capturedAt, createdAt, updatedAt, assignedAt, sentAt, solvedAt, overdue, photos: Photo[] }`
`Photo = { id, kind, url, width, height, sortOrder, createdAt }`
`StatusChange = { id, from, to, note, createdAt }`

| Method | Path | Body / query | Data |
|---|---|---|---|
| POST | `/issues` | multipart: `id` (uuid, client), `siteId`, `capturedAt`, `description?`, `location?`, `categoryId?`, `workerId?`, `priority?`, `photo` (jpeg/png/webp ≤ 4 MB) | Issue (201 created, **200 with the existing issue if `id` already exists** — idempotent). Status from the §4 rules (shared `applyPatch` on a fresh `new`): photo only / trade without description → `new`; trade + description → `unassigned`; + worker → `assigned` (`assignedAt` set). History: `none → new` plus one row for the landing move. Refusals create nothing: 409 ARCHIVED_SITE · INACTIVE_CATEGORY · INACTIVE_WORKER · WORKER_LACKS_CATEGORY · ISSUE_REQUIREMENTS (worker without trade or description) · 404 site/category/worker · 400 bad field |
| POST | `/issues/:id/photos` | multipart `photo`, `kind` | Issue · 409 limit 10 reached |
| DELETE | `/issues/:id/photos/:photoId` | — | Issue · 409 last before-photo |
| GET | `/issues` | `IssueFilter`: `siteId, categoryId, workerId, status (comma list), priority (comma list), overdue (bool), capturedFrom, capturedTo, solvedFrom, solvedTo, q, sort (newest\|oldest\|priority\|estimate), page, limit` | `Issue[]` + meta |
| GET | `/issues/:id` | — | Issue + `history: StatusChange[]` |
| PATCH | `/issues/:id` | `{ description?, location?, priority?, categoryId?, workerId? (null to remove), estimatedDate? (null to clear) }` | Issue — applies the automatic moves in §4 (worker on unassigned → assigned, worker removed → unassigned, category the worker lacks → worker removed, date on assigned/sent → estimated, sort out of `new` when category + description are set) |
| POST | `/issues/:id/status` | `{ status, note? (≤1000), estimatedDate? }` | Issue · 409 requirements not met / back to new |
| POST | `/issues/bulk` | `{ ids (1–200), categoryId?, status?, workerId?, note? }` | `{ updated: number, issues: Issue[] }` — all-or-nothing; 409 lists the ids that fail |
| POST | `/issues/:id/merge` | `{ sourceId }` (both `new`) | Issue (target) · 409 not both new / over 10 photos |
| DELETE | `/issues/:id` | — | `{ id }` — permanent, any status (business §3): the issue, its photos and status history in one transaction; photo files removed from storage after commit, best-effort (a failure is logged). The site's number counter is untouched (never reused) |
| GET | `/issues/export.csv` | `IssueFilter` + `columns` (comma list) + `lang` | CSV |
| GET | `/issues/history.csv` | `IssueFilter` + `lang` | CSV |

## Dashboard
| Method | Path | Query | Data |
|---|---|---|---|
| GET | `/dashboard` | `?siteId` | `{ byStatus: Record<IssueStatus, number>, overdue, inbox, byCategory: {category, open, overdue}[], byWorker: {worker, open, overdue}[], bySite: {site, open, new, overdue}[] }` |

## Errors
400 validation (field messages in `error`) · 401 not signed in · 404 unknown id · 409 rule refused with a
coded message (`ISSUE_REQUIREMENTS`, `BACK_TO_NEW`, `LAST_PHOTO`, `PHOTO_LIMIT`, `IN_USE`, `DUPLICATE`,
`WORKER_LACKS_CATEGORY`, `INACTIVE_WORKER`, `INACTIVE_CATEGORY`, `ARCHIVED_SITE`, `NOT_NEW`, `WORKER_HAS_ISSUES`) · 413 file
too large · 429 rate-limited.
