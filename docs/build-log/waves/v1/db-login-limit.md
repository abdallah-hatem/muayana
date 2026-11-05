# db-login-limit — login rate limit in Postgres, seed photos through PhotoStorage

Branch `fix/db-login-limit` (from `dev`). Commit `eaf97a7`.

## Built
- **Login rate limit survives serverless.** New `LoginFailure` table (`login_failures`: id, key,
  at timestamptz; indexes on (key, at) and (at)); migration `20261105184349_login_failures`.
  `PrismaLoginAttemptStore` (`apps/api/src/domains/auth/repositories/prisma-login-attempt.store.ts`)
  is the app's `LOGIN_ATTEMPT_STORE`: one `groupBy` read per attempt for both keys, a failure is
  written for both keys in one transaction that also prunes rows older than the window (no cron),
  success deletes both keys. The in-memory store stays for unit tests only.
- **Email-only ceiling.** Keys are `ip:<ip or unknown>|<email>` (5 per 15 min, unchanged) and
  `email:<email>` (new `LOGIN_MAX_FAILURES_PER_EMAIL = 20` in `packages/shared`). 429 keeps
  `data.retryAfterSeconds` (the longer wait of the locked counters). Rule in `auth.pure.ts`
  `loginLockedFor`.
- **Seed photos.** `prisma/seed-photos.ts` renders placeholders and writes them through the API's
  `PhotoStorage`; `storage.module.ts` gained `photoStorageFor(settings)` (shared by the module
  factory and the seed). Files are stored before the site's transaction and the rows store the
  driver's returned key/url (Blob adds a suffix). A sample site that exists is skipped whole; with
  the local driver missing files are restored at the same key. Jest `roots` now include `prisma/`.

## Tests
- API unit: 24 suites, 144 tests. e2e: 10 suites, 125 tests. `test:e2e:serverless`: 10 suites,
  125 tests. `npm run lint`, `npm run typecheck`: clean. Seed run twice on the agent DB (local
  driver): 62 photos, re-run skipped all sites and restored 3 deleted files.

## Edge cases ↔ tests
- Limit holds across two instances sharing the DB → `login-limit-shared.e2e-spec.ts` "limit holds across two app instances sharing the DB"
- Email-only ceiling (also with no X-Forwarded-For; other email unaffected) → same file "email-only ceiling: …"; unit `auth.service.spec` "locks the email for every IP once the email-only ceiling is reached"; `auth.pure.spec` "email-only ceiling …", "both locked: the longer wait wins"
- Window expiry with the injectable clock + pruning → same file "window expiry with the injectable clock: the lock lifts and old rows are pruned"
- Existing auth e2e (6th failure → 429, window passes, success resets, IP trusted/untrusted) → unchanged and green
- Seed photos through a mocked storage → `prisma/seed-photos.spec.ts` (JPEG via driver, driver's key/url kept, re-run restores only missing)
- Blob driver without token from raw env → `storage.module.spec` "refuses the Blob driver without a token"

## Notes / deviations
- Business §2 was a vague GUESS; now states the exact rule (5 per IP+email, 20 per email, DB-backed)
  and the lock-out trade-off of the email ceiling. Recent-changes line added.
- A successful sign-in clears both the IP key and the email key.
- e2e `createTestApp` now empties `login_failures` (earlier suites' FakeClocks run ahead);
  `resetLoginLimit: false` for a second instance sharing counts.
- DEPLOY.md: Preview sample seed should pass `STORAGE_DRIVER=blob` + `BLOB_READ_WRITE_TOKEN`.
- `deploy-ready.md` (another task's report) still mentions the in-memory store; left untouched.
