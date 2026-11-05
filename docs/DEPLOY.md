# Deploying Muayana to Vercel

A step-by-step guide for deploying from a fresh PC. Nothing here has been deployed for you: you run
every step yourself, in order. Budget about an hour the first time.

**The shape of it.** Two Vercel projects built from one GitHub repo:

| Vercel project | Root Directory | What it is | Talks to |
|---|---|---|---|
| `muayana-api` | `apps/api` | NestJS API (native `nestjs` preset) | Neon Postgres, Vercel Blob |
| `muayana-web` | `apps/web` | Next.js app (installable PWA) | `muayana-api`, server-side only |

The browser only ever talks to `muayana-web`. Its server forwards each call to the API through the
`/api/proxy` route, using `API_URL`. Photos are uploaded to a Vercel Blob store and opened straight
from Blob URLs.

**Branches.** `production` is live: pushing to it deploys Production. `dev` (and every other branch)
deploys a Preview.

---

## 1. Prerequisites

Install these on the new PC:

1. **Node.js 24** (LTS) from <https://nodejs.org>. Check it with `node -v`, which should print `v24.…`.
2. **Git** from <https://git-scm.com>. Check it with `git --version`.
3. A **Vercel account** (<https://vercel.com>) connected to the GitHub account that owns the repo:
   Vercel → Account Settings → Authentication → GitHub.
4. Sign in to the **Vercel CLI**. `npx` runs it without a global install:
   ```bash
   npx vercel login
   ```
   The `vercel …` commands below mean `npx vercel …`. You can also install it once with
   `npm i -g vercel`.

Docker is **not** needed to deploy. You only need it to run the app locally.

## 2. Get the code

```bash
git clone https://github.com/abdallah-hatem/muayana
cd muayana
git switch production   # if it doesn't exist yet: git switch -c production origin/dev && git push -u origin production
git switch dev
npm install             # builds packages/shared and generates the Prisma client
```

You need `npm install` on this PC to run migrations and the seed in step 7.

Keep a private notes file, **`CREDENTIALS.local.md`** at the repo root (gitignored, never committed).
Write down every resource you create: the Vercel team, project names, Neon database, Blob store,
which env vars exist in which environment, and the engineer login. Don't rely on memory.

## 3. Create the two Vercel projects

### Option A: from the dashboard, linked to GitHub (recommended)

Pushing a branch then deploys it, and every build comes from a commit, not from one PC's files.

Do this **twice**, once per row of the table at the top:

1. Vercel dashboard → **Add New… → Project** → import `abdallah-hatem/muayana`.
2. **Project Name:** `muayana-api` (then `muayana-web`).
3. **Root Directory:** click *Edit* and pick `apps/api` (then `apps/web`). This is required: the
   repo root is not an app, and a project without a Root Directory fails to build.
4. **Framework Preset:** `NestJS` for the API, `Next.js` for the web app. It should be detected,
   but check it.
5. Leave the Build and Install commands alone. Each app has a `vercel.json` that sets them:
   - install: `cd ../.. && npm ci`, which installs the whole monorepo from the root lockfile;
   - API build: build `packages/shared` → `prisma generate` → `nest build` (it does **not** run
     migrations; see step 7);
   - web build: build `packages/shared` → `next build`.
6. **Don't add env vars yet.** Click *Deploy*. The first API deployment will fail or answer 500
   because it has no config yet. That's expected.
7. Then, in each project:
   - **Settings → Build and Deployment → Node.js Version:** `24.x`.
   - **Settings → Build and Deployment → Root Directory:** make sure *Include files outside the
     root directory in the Build Step* is **on**. It is on by default, and the build needs
     `packages/shared`.
   - **Settings → Environments → Production → Branch Tracking:** set the production branch to
     `production`. Every other branch, `dev` included, then builds a **Preview**.

Then link your local folders to the projects so the CLI commands below know which project they're
for:

```bash
cd apps/api && vercel link --project muayana-api && cd ../..
cd apps/web && vercel link --project muayana-web && cd ../..
```

If your account has more than one team, add `--scope <team-slug>` to the link commands. Run
`vercel projects ls` first to check which team the projects are in.

### Option B: CLI only

```bash
cd apps/api && vercel link --yes --project muayana-api && cd ../..
cd apps/web && vercel link --yes --project muayana-web && cd ../..
```

This creates the projects without GitHub. Then set the Root Directory, Node.js version and
production branch in each project's Settings, as in Option A step 7. Connect GitHub later under
**Settings → Git** so that pushes deploy.

> `vercel link` adds `.env*` to `.gitignore`, which would also hide `.env.example`. This repo's
> `.gitignore` already has `!.env.example` and `!.env.*.example` after it. If `git status` shows a
> changed `.gitignore` after linking, keep those two lines.

## 4. Database: Neon Postgres (API project only)

```bash
cd apps/api
vercel integration add neon
cd ../..
```

Follow the prompts: create a new Neon database, pick a region close to you (for example Frankfurt
`eu-central-1`) and connect it to **`muayana-api`**. Do **not** connect it to `muayana-web`, which
never touches the database.

The integration writes the env vars itself, so you never paste a password. The two you care about:

| Variable | What it is | Used by |
|---|---|---|
| `DATABASE_URL` | **pooled** endpoint (host contains `-pooler`) | the running API |
| `DATABASE_URL_UNPOOLED` | direct endpoint | migrations and the seed, from your PC only |

Then check which environments got them: **muayana-api → Settings → Environment Variables**. You
want `DATABASE_URL` in **Production and Preview**. If Preview uses the same database as Production,
previews will read and write real data. You can avoid that by creating a separate Neon branch for
Preview: Neon console → Branches → *Create branch* `preview`, then set Preview's `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` to that branch's pooled and direct URLs. If Preview shares Production's
database, never seed sample data into it (step 7).

On Vercel the API keeps **one** database connection per function instance, with a 20 s connect
timeout (`apps/api/src/database/database.service.ts`). This works together with Neon's pooler and
doesn't replace it. You don't need to configure anything.

## 5. Photos: Vercel Blob (API project only)

```bash
cd apps/api
vercel blob create-store muayana-photos --access public
cd ../..
```

If it asks which environments to connect, choose **Production and Preview**. This sets
`BLOB_READ_WRITE_TOKEN` on `muayana-api`. Blob is a first-party Vercel product, so
`vercel integration add blob` doesn't exist. You can also do this in the dashboard: muayana-api →
Storage → Create → Blob → access **Public**.

> **Why public? This is deliberate.** Business rule
> [§6.10](business/06-invariants.md) says everything needs a sign-in **except photo files**. Photo
> links are sent to workers on WhatsApp and must open on their phones without an account. So the
> store is **public** and every file is saved with a **random suffix**
> (`addRandomSuffix: true` in `apps/api/src/common/storage/blob-photo.storage.ts`). The URL can't
> be guessed and is never listed anywhere. The other side of that: **anyone who has a photo link
> can open it, forever**, unless the photo is deleted. Don't switch the store to private. Private
> Blob URLs need a token to open, which breaks the WhatsApp links.

## 6. Environment variables

Set these in **Settings → Environment Variables** of each project. Tick **Production** and
**Preview** for each one unless the table says otherwise. Vercel keeps every environment separate,
so a value set only for Production does not exist in Preview, and the other way round.

To generate a `JWT_SECRET` (run it twice, once for each environment):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### muayana-api

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `DATABASE_URL` | set by Neon | set by Neon (or your preview branch) | pooled URL |
| `DATABASE_URL_UNPOOLED` | set by Neon | set by Neon | not read by the app; for migrations |
| `BLOB_READ_WRITE_TOKEN` | set by Blob | set by Blob | |
| `STORAGE_DRIVER` | `blob` | `blob` | **required**: a Vercel function's disk does not survive |
| `JWT_SECRET` | a new random value | a **different** random value | ≥ 32 characters |
| `CORS_ORIGINS` | `https://muayana-web.vercel.app` | `https://muayana-web-git-dev-<team-slug>.vercel.app` | the web app's URL(s), comma-separated. Check the real URLs on muayana-web's Domains / Deployments page |
| `TRUST_PROXY` | `true` | `true` | see step 10 |

Do **not** set any of these on Vercel:
- `NODE_ENV`. Vercel sets it itself, and `production` at install time would skip the
  devDependencies that the build needs.
- `PORT`, `UPLOAD_DIR`, `PUBLIC_UPLOAD_BASE_URL`. They only apply locally.
- `VERCEL`. Vercel sets it.
- `SEED_*`. The seed runs from your PC (step 7).

The API checks every variable when it starts. A missing or malformed one stops it with
`Invalid environment configuration: …` in the **Runtime Logs**.

### muayana-web

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `API_URL` | `https://muayana-api.vercel.app/api/v1` | `https://muayana-api-git-dev-<team-slug>.vercel.app/api/v1` | must end with `/api/v1`. Read on the server only, never sent to the browser |

Use each project's **stable** URL: the production domain, or the `-git-dev-` branch alias for
Preview. Don't use the URL of one particular deployment (`muayana-api-abc123…vercel.app`). That
URL keeps pointing at the old build after you redeploy.

### Deployment Protection (Preview)

By default Vercel puts its own login wall in front of **Preview** deployments. The web server calls
the API from code, so it can't pass that wall: on Preview every API call comes back as a Vercel
login page, and sign-in fails. Fix it in **muayana-api → Settings → Deployment Protection**: turn
**Vercel Authentication** off for muayana-api. The API has its own sign-in, and every route except
`/health` needs a token. You can leave protection on for `muayana-web`, so a Preview link asks
visitors to log in to Vercel first.

Production deployments aren't behind that wall, so Production isn't affected.

## 7. Migrate and seed the database (from your PC)

Migrations **never** run during a Vercel build. Builds can run at the same time, and changing a live
database should be your decision. You run them by hand against the **unpooled** URL.

Pull the API's Production variables into a temporary file. It's gitignored, but **delete it when
you're done**:

```bash
cd apps/api
vercel env pull .env.production.local --environment=production
```

Open it and copy the value of `DATABASE_URL_UNPOOLED`. Then, in **Git Bash**:

```bash
# Apply every migration (run this again after any release that adds a migration)
DATABASE_URL="<paste DATABASE_URL_UNPOOLED>" npx prisma migrate deploy

# Create the engineer account and the 12 default categories. Safe to re-run: an existing account
# is never overwritten.
DATABASE_URL="<paste DATABASE_URL_UNPOOLED>" \
SEED_ENGINEER_EMAIL="you@example.com" \
SEED_ENGINEER_PASSWORD="<a strong password, 16+ characters>" \
SEED_ENGINEER_NAME="<your name>" \
NODE_ENV=production \
npx prisma db seed

rm .env.production.local
cd ../..
```

- Use a **strong, unique** password and write it in `CREDENTIALS.local.md`. It's the only account,
  and the API is on the public internet.
- `NODE_ENV=production` makes the seed refuse sample data, so real data stays clean.
- **Preview** database: repeat with `--environment=preview` and that database's unpooled URL. Use
  `SEED_ALLOW_SAMPLE=true` here **only** if Preview has its own database (step 4). Leave out
  `NODE_ENV=production` in that case. The sample photos are placeholder files written to your PC,
  so they show as broken images on Preview. Everything else in the sample works.

In PowerShell, set the variables first instead, for example
`$env:DATABASE_URL="<…>"; npx prisma migrate deploy`. Then clear them with
`Remove-Item Env:DATABASE_URL`.

## 8. Deploy: API first, then web

The web app needs the API's URL, so the order matters.

1. **API.** With the env vars set, start a **new** build. Pushing to `production` does it:
   ```bash
   git switch production && git merge --ff-only dev && git push && git switch dev
   ```
   You can also run `vercel deploy --prod` from `apps/api`, or use Deployments → ⋯ → *Redeploy* in
   the dashboard with *Use existing Build Cache* **unticked**. Don't use `vercel redeploy` after
   changing env vars: it reuses the old build, and the new values aren't picked up.
2. Check the API: open `https://muayana-api.vercel.app/api/v1/health`. You should get
   `{"success":true,…,"data":{"status":"ok","database":"up",…}}`.
3. **Web.** Set `API_URL` (step 6) if you haven't yet, then start a new build of `muayana-web` the
   same way. A change to an env var only applies to deployments built **after** the change.

## 9. Smoke checklist after every production deploy

A green **Ready** in the dashboard only means the code compiled. It doesn't prove the app runs.
Check each of these:

- [ ] `https://muayana-api.vercel.app/api/v1/health` → `status: ok`, `database: up`.
- [ ] Open `https://muayana-web.vercel.app` → the sign-in page appears in Arabic. Sign in with the
      seeded engineer account.
- [ ] **On a phone**, open a site and **capture a photo** of anything. The issue appears with its
      photo, and the photo URL starts with `https://…public.blob.vercel-storage.com/`.
- [ ] **WhatsApp share:** assign that issue to a worker and send it. Open the photo link on another
      phone that is **not** signed in. It must open.
- [ ] **CSV export:** export issues and open the file in **Excel**. The Arabic text must read
      correctly, not as `Ø§Ù„…`.
- [ ] Sign out, then sign in again.
- [ ] The rate-limit check in step 10.

If any step fails, see Troubleshooting below.

## 10. Client IP behind the proxy (`TRUST_PROXY`)

After 5 failed sign-ins in 15 minutes, the API blocks further sign-ins for that IP address + email
pair. Behind Vercel, the API is called by the **web server**, not by the phone, so it has to find the
phone's IP somewhere. The web proxy copies the browser's IP into `X-Forwarded-For`, and
`TRUST_PROXY=true` tells the API to read it from there.

**Test it once after the first deploy:**
1. In one browser (say, your laptop), sign in **5 times with a wrong password** using the real
   email.
2. On a **second device on a different network** (a phone on mobile data, not Wi-Fi), sign in with
   the **right** password.
3. The phone must get in. If the phone is **also** blocked, the API is seeing one IP for everyone.
   Set `TRUST_PROXY=false` on muayana-api (Production and Preview), deploy the API again, and repeat
   the test.

Two limits to know about:
- The failure counter lives in the API's memory. On Vercel each function instance has its own
  counter, and a counter resets when an instance restarts. So the limit slows guessing down. It
  doesn't block it exactly. A strong password (step 7) is the real protection.
- Vercel may replace `X-Forwarded-For` with the address of the server that called the API. In that
  case every sign-in shares one counter, and the test above shows it.

## 11. Install the PWA on a phone

- **Android (Chrome):** open the production web URL → ⋮ menu → **Install app** (or *Add to Home
  screen*).
- **iPhone (Safari):** open the URL → Share button → **Add to Home Screen**.

The app opens full-screen from the home-screen icon. Captures work offline and upload when the
phone is back online. Install from the **production** URL, not from a Preview link.

## 12. Rollback

If a production deploy is broken:

1. **muayana-api** (or **muayana-web**) → **Deployments** → find the last good Production
   deployment → ⋯ → **Promote to Production** (also called *Instant Rollback*). It's live within
   seconds, with no rebuild.
2. Then fix the problem on `dev` and release again.

A rollback does **not** undo database migrations. If the broken release added a migration, the old
code is now running against the new schema. Migrations in this repo only add things, so old code
normally keeps working. Write a new migration to fix the schema. Never edit or delete an applied
one.

## 13. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Deployment says **Ready**, but every API request returns **500** | Startup crash: a missing or invalid env var, an ES-module-only dependency (`ERR_REQUIRE_ESM`), or the Prisma client not generated | Open the deployment → **Runtime Logs** (not the build log). `Invalid environment configuration` → fix that variable for **that** environment, then deploy again. `ERR_REQUIRE_ESM` → a dependency became ESM-only: pin its last CommonJS version (every dependency is checked to `require()` cleanly as of this guide). `PrismaClientInitializationError` → check that the build log shows `prisma generate` |
| Requests **hang** 20–60 s and then fail, with nothing in the logs | The database connection pool is exhausted, or Neon is waking up from idle | The first request after Neon has been idle can take a few seconds, and that's normal. If it happens all the time, check that `DATABASE_URL` is the **pooled** URL (`-pooler` in the host). The API already caps itself at one connection per instance |
| Works in Production but not in Preview (or the other way round) | The env var is set for only one environment | **Settings → Environment Variables** and look at each variable's environments, or run `vercel env ls` from `apps/api` / `apps/web` |
| Changed an env var, but nothing changed | `vercel redeploy` (or a redeploy *with build cache*) reuses the old build | Push a commit, or `vercel deploy --prod`, or Redeploy with the cache **unticked** |
| Web shows "server unavailable" or every call fails | `API_URL` is wrong, missing `/api/v1`, points at one specific deployment URL, or (Preview) Deployment Protection is blocking the API | Fix `API_URL` (step 6), turn off Vercel Authentication on muayana-api (step 6), then deploy the web app again |
| The build fails with `Cannot find module '@muayana/shared'` | The Root Directory or *Include files outside the root directory* setting is wrong | Step 3 → 7 |
| A photo upload fails with **413** | The file is over Vercel's 4.5 MB request limit | The app compresses photos to ≤ 4 MB before upload. This only happens if compression failed on that device. Try again, or use a smaller photo |
| Photos upload but show as broken images | `STORAGE_DRIVER` isn't `blob`, or the Blob store is private | Set `STORAGE_DRIVER=blob` and use a **public** store (step 5) |
| Sign-in blocks a second device after one device failed 5 times | The client IP isn't reaching the API | Step 10 |

## Releasing later

1. Merge your work into `dev`. The Preview deploys and you test it there.
2. If the release adds a migration, run `prisma migrate deploy` against **Production** first
   (step 7). Migrations add things, so the running code isn't affected.
3. Fast-forward `production` to `dev` and push (step 8). Vercel deploys both projects.
4. Go through the smoke checklist (step 9).
