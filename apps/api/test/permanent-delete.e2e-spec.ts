import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import request from 'supertest';
import {
  DomainErrorCode,
  type Dashboard,
  type Issue,
  type IssueDetail,
  type IssueStatus,
  type Worker,
  type WorkerIssuesSummary,
} from '@muayana/shared';
import {
  PHOTO_STORAGE,
  type PhotoStorage,
} from '../src/common/storage/photo-storage.interface';
import { resolveUploadDir } from '../src/common/utils/upload-dir.util';
import type { Env } from '../src/config/env.validation';
import {
  makeCategory,
  makeSite,
  makeWorker,
  resetDomainData,
} from './helpers/domain-data';
import {
  bearer,
  createEngineer,
  createTestApp,
  type Engineer,
  type TestApp,
} from './helpers/test-app';

/*
 * Permanent delete of issues (D1) and contractors (D2) — spec 2026-11-09-permanent-delete.md.
 * One test per edge case, named after it.
 */

const API = '/api/v1';
const ISSUES = `${API}/issues`;
const WORKERS = `${API}/workers`;

let t: TestApp;
let engineer: Engineer;
let jpeg: Buffer;

type Body<T> = { data: T; error?: string };
const auth = () => ({ Authorization: bearer(engineer.token) });
const get = (path: string) => request(t.http).get(path).set(auth());
const del = (path: string) => request(t.http).delete(path).set(auth());

/** Fixture ids, remade before each test. */
const f = { site: '', paint: '', painter: '', other: '' };

const ALL_STATUSES: readonly IssueStatus[] = [
  'new',
  'unassigned',
  'assigned',
  'sent',
  'estimated',
  'in_progress',
  'solved',
  'cancelled',
];

/** Captures an issue through the API (so it has a stored photo file) and moves it to `status`. */
async function issueIn(
  status: IssueStatus,
  { workerId = f.painter, siteId = f.site, extraPhotos = 0 } = {},
): Promise<Issue> {
  const req = request(t.http)
    .post(ISSUES)
    .set(auth())
    .field('id', randomUUID())
    .field('siteId', siteId)
    .field('capturedAt', new Date().toISOString());
  if (status !== 'new') {
    void req.field('categoryId', f.paint).field('description', 'Cracked wall');
    if (status !== 'unassigned') void req.field('workerId', workerId);
  }
  void req.attach('photo', jpeg, {
    filename: 'p.jpg',
    contentType: 'image/jpeg',
  });
  const issue = (await req.expect(201)).body as Body<Issue>;
  const id = issue.data.id;
  for (let i = 0; i < extraPhotos; i++) {
    await request(t.http)
      .post(`${ISSUES}/${id}/photos`)
      .set(auth())
      .field('kind', 'after')
      .attach('photo', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' })
      .expect(201);
  }
  if (!['new', 'unassigned', 'assigned'].includes(status)) {
    const body: Record<string, string> = { status };
    if (status === 'estimated') body.estimatedDate = '2099-01-01';
    await request(t.http)
      .post(`${ISSUES}/${id}/status`)
      .set(auth())
      .send(body)
      .expect(200);
  }
  return (await get(`${ISSUES}/${id}`).expect(200)).body.data as Issue;
}

const detail = async (id: string): Promise<IssueDetail> =>
  ((await get(`${ISSUES}/${id}`).expect(200)).body as Body<IssueDetail>).data;

/** The stored file paths of an issue's photos (local driver in e2e). */
async function photoFiles(issueId: string): Promise<string[]> {
  const config = t.app.get<ConfigService<Env, true>>(ConfigService);
  const root = resolveUploadDir(config.get('UPLOAD_DIR', { infer: true }));
  const rows = await t.db.photo.findMany({
    where: { issueId },
    select: { storageKey: true },
  });
  return rows.map((r) => join(root, r.storageKey));
}

async function dashboard(): Promise<Dashboard> {
  return ((await get(`${API}/dashboard`).expect(200)).body as Body<Dashboard>)
    .data;
}

async function workerCounts(id: string): Promise<Worker['counts']> {
  return ((await get(`${WORKERS}/${id}`).expect(200)).body as Body<Worker>).data
    .counts;
}

async function issuesCsv(lang: 'ar' | 'en' = 'en'): Promise<string> {
  const res = await get(`${ISSUES}/export.csv?lang=${lang}&siteId=${f.site}`)
    .buffer(true)
    .parse((r, done) => {
      let text = '';
      r.setEncoding('utf8');
      r.on('data', (c: string) => (text += c));
      r.on('end', () => done(null, text));
    })
    .expect(200);
  return res.body as string;
}

async function gone(issueId: string): Promise<void> {
  expect(await t.db.issue.count({ where: { id: issueId } })).toBe(0);
  expect(await t.db.photo.count({ where: { issueId } })).toBe(0);
  expect(await t.db.statusChange.count({ where: { issueId } })).toBe(0);
}

beforeAll(async () => {
  t = await createTestApp();
  engineer = await createEngineer(t);
  jpeg = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#39c' },
  })
    .jpeg()
    .toBuffer();
});

beforeEach(async () => {
  await resetDomainData(t.db);
  f.site = (await makeSite(t.db, 'Delete Tower')).id;
  f.paint = (await makeCategory(t.db, 'دهانات')).id;
  f.painter = (await makeWorker(t.db, [f.paint], { name: 'Sayed Painter' })).id;
  f.other = (await makeWorker(t.db, [f.paint], { name: 'Other Painter' })).id;
});

afterAll(async () => {
  if (t) await resetDomainData(t.db);
  await t?.close();
});

// ================================================================== D1

describe('DELETE /issues/:id (D1)', () => {
  it('Delete an issue in each status (new, assigned, solved…) → 200, issue, photos rows and history rows gone (§3)', async () => {
    for (const status of ALL_STATUSES) {
      const issue = await issueIn(status, { extraPhotos: 1 });
      expect(issue.status).toBe(status);
      expect(
        await t.db.statusChange.count({ where: { issueId: issue.id } }),
      ).toBeGreaterThan(0);
      const res = await del(`${ISSUES}/${issue.id}`).expect(200);
      expect((res.body as Body<{ id: string }>).data).toEqual({ id: issue.id });
      await gone(issue.id);
      await get(`${ISSUES}/${issue.id}`).expect(404);
    }
  });

  it('Photo files removed from storage after delete; storage failure → still deleted, error logged (§3)', async () => {
    const issue = await issueIn('solved', { extraPhotos: 1 });
    const files = await photoFiles(issue.id);
    expect(files).toHaveLength(2);
    for (const file of files) expect(existsSync(file)).toBe(true);
    await del(`${ISSUES}/${issue.id}`).expect(200);
    for (const file of files) expect(existsSync(file)).toBe(false);

    // Storage down: the delete still stands, the failure is logged.
    const failing = await issueIn('assigned');
    const storage = t.app.get<PhotoStorage>(PHOTO_STORAGE);
    const remove = jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('storage unavailable'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await del(`${ISSUES}/${failing.id}`).expect(200);
      await gone(failing.id);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('storage unavailable'),
      );
    } finally {
      remove.mockRestore();
      warn.mockRestore();
    }
  });

  it('Next capture on that site gets the next number, never the deleted one (§6.12)', async () => {
    const first = await issueIn('new');
    const last = await issueIn('solved');
    expect(last.number).toBe(first.number + 1);
    await del(`${ISSUES}/${last.id}`).expect(200);
    const next = await issueIn('new');
    expect(next.number).toBe(last.number + 1);
  });

  it('Unknown id → 404; unauthenticated → 401 (§6.10)', async () => {
    await del(`${ISSUES}/${randomUUID()}`).expect(404);
    const issue = await issueIn('assigned');
    await request(t.http).delete(`${ISSUES}/${issue.id}`).expect(401);
    expect(await t.db.issue.count({ where: { id: issue.id } })).toBe(1);
  });

  it('Deleted issue disappears from list, dashboard counts, worker counts and exports (§5.8, §5.9, §7)', async () => {
    const keep = await issueIn('in_progress');
    const doomed = await issueIn('in_progress');
    const before = await dashboard();
    expect(before.byStatus.in_progress).toBe(2);
    expect((await workerCounts(f.painter)).in_progress).toBe(2);
    expect(await issuesCsv()).toContain(`\r\n${doomed.number},`);

    await del(`${ISSUES}/${doomed.id}`).expect(200);

    const list = (await get(`${ISSUES}?siteId=${f.site}`).expect(200))
      .body as Body<Issue[]>;
    expect(list.data.map((i) => i.id)).toEqual([keep.id]);
    const after = await dashboard();
    expect(after.byStatus.in_progress).toBe(1);
    expect(after.byWorker.find((w) => w.worker.id === f.painter)?.open).toBe(1);
    expect((await workerCounts(f.painter)).in_progress).toBe(1);
    const csv = await issuesCsv();
    expect(csv).not.toContain(`\r\n${doomed.number},`);
    expect(csv).toContain(`\r\n${keep.number},`);
  });
});

// ================================================================== D2

describe('DELETE /workers/:id (D2)', () => {
  it('Contractor with no issues → deleted with plain DELETE (§3)', async () => {
    const res = await del(`${WORKERS}/${f.other}`).expect(200);
    expect((res.body as Body<{ id: string }>).data).toEqual({ id: f.other });
    expect(await t.db.worker.count({ where: { id: f.other } })).toBe(0);
  });

  it('With issues and no `issues` param → 409 WORKER_HAS_ISSUES with correct counts; nothing changes (§6.8)', async () => {
    const open = [await issueIn('assigned'), await issueIn('estimated')];
    const solved = await issueIn('solved', { extraPhotos: 2 });
    const cancelled = await issueIn('cancelled');
    await issueIn('assigned', { workerId: f.other }); // not his

    const res = await del(`${WORKERS}/${f.painter}`).expect(409);
    const body = res.body as Body<WorkerIssuesSummary>;
    expect(body.error).toBe(DomainErrorCode.WORKER_HAS_ISSUES);
    expect(body.data).toEqual({
      open: 2,
      solved: 1,
      cancelled: 1,
      total: 4,
      photos: 6,
    });

    expect(await t.db.worker.count({ where: { id: f.painter } })).toBe(1);
    for (const issue of [...open, solved, cancelled]) {
      const now = await detail(issue.id);
      expect(now.status).toBe(issue.status);
      expect(now.worker?.id).toBe(f.painter);
      expect(now.history).toHaveLength(issue.status === 'assigned' ? 2 : 3);
    }
  });

  it('`keep`: assigned/sent/estimated/in_progress → unassigned, estimate cleared, exactly one history record each naming him (§3, §6.7)', async () => {
    const open: Issue[] = [];
    for (const status of [
      'assigned',
      'sent',
      'estimated',
      'in_progress',
    ] as const)
      open.push(await issueIn(status));
    const historyBefore = new Map<string, number>();
    for (const issue of open)
      historyBefore.set(issue.id, (await detail(issue.id)).history.length);

    await del(`${WORKERS}/${f.painter}?issues=keep`).expect(200);

    for (const issue of open) {
      const now = await detail(issue.id);
      expect(now).toMatchObject({
        status: 'unassigned',
        worker: null,
        estimatedDate: null,
        formerWorkerName: null,
      });
      expect(now.history).toHaveLength(historyBefore.get(issue.id)! + 1);
      expect(now.history[now.history.length - 1]).toMatchObject({
        from: issue.status,
        to: 'unassigned',
        note: expect.stringContaining('Sayed Painter'),
      });
    }
  });

  it('`keep`: solved/cancelled keep status, worker removed, formerWorkerName set; solved still valid (§6.2)', async () => {
    const solved = await issueIn('solved');
    const cancelled = await issueIn('cancelled');
    const historyBefore = (await detail(solved.id)).history.length;

    await del(`${WORKERS}/${f.painter}?issues=keep`).expect(200);

    for (const issue of [solved, cancelled]) {
      const now = await detail(issue.id);
      expect(now).toMatchObject({
        status: issue.status,
        worker: null,
        formerWorkerName: 'Sayed Painter',
      });
    }
    // No status moved, so no history row was written.
    expect((await detail(solved.id)).history).toHaveLength(historyBefore);

    // Still a valid solved issue: editing it keeps it solved, a same-status move is a no-op.
    const edited = await request(t.http)
      .patch(`${ISSUES}/${solved.id}`)
      .set(auth())
      .send({ description: 'Repainted' })
      .expect(200);
    expect((edited.body as Body<Issue>).data).toMatchObject({
      status: 'solved',
      formerWorkerName: 'Sayed Painter',
    });
    await request(t.http)
      .post(`${ISSUES}/${solved.id}/status`)
      .set(auth())
      .send({ status: 'solved' })
      .expect(200);
    // But it can't go back to a working status without a real worker.
    const back = await request(t.http)
      .post(`${ISSUES}/${solved.id}/status`)
      .set(auth())
      .send({ status: 'in_progress' })
      .expect(409);
    expect((back.body as Body<null>).error).toBe(
      DomainErrorCode.ISSUE_REQUIREMENTS,
    );

    // The export names him, marked deleted.
    expect(await issuesCsv('en')).toContain('Sayed Painter (deleted)');
    expect(await issuesCsv('ar')).toContain('Sayed Painter (محذوف)');
  });

  it('`keep`: reopen a solved issue with only formerWorkerName → unassigned (§4)', async () => {
    const solved = await issueIn('solved');
    await del(`${WORKERS}/${f.painter}?issues=keep`).expect(200);
    const res = await request(t.http)
      .post(`${ISSUES}/${solved.id}/status`)
      .set(auth())
      .send({ status: 'assigned', note: 'Came back' })
      .expect(200);
    expect((res.body as Body<Issue>).data).toMatchObject({
      status: 'unassigned',
      worker: null,
    });
    // Choosing a new contractor replaces the deleted one's kept name.
    const chosen = await request(t.http)
      .patch(`${ISSUES}/${solved.id}`)
      .set(auth())
      .send({ workerId: f.other })
      .expect(200);
    expect((chosen.body as Body<Issue>).data).toMatchObject({
      status: 'assigned',
      worker: { id: f.other },
      formerWorkerName: null,
    });
  });

  it("`delete`: all his issues + photos + history gone, other contractors' issues untouched, photo files removed (§3)", async () => {
    const his = [
      await issueIn('assigned', { extraPhotos: 1 }),
      await issueIn('solved'),
      await issueIn('cancelled'),
    ];
    const files = (await Promise.all(his.map((i) => photoFiles(i.id)))).flat();
    expect(files).toHaveLength(4);
    const others = await issueIn('in_progress', { workerId: f.other });
    const unassigned = await issueIn('unassigned');

    await del(`${WORKERS}/${f.painter}?issues=delete`).expect(200);

    for (const issue of his) await gone(issue.id);
    for (const file of files) expect(existsSync(file)).toBe(false);
    expect(await detail(others.id)).toMatchObject({
      status: 'in_progress',
      worker: { id: f.other },
    });
    expect((await detail(unassigned.id)).status).toBe('unassigned');
    for (const file of await photoFiles(others.id))
      expect(existsSync(file)).toBe(true);
  });

  it('Either choice: worker row and category links gone; dashboard/worker lists updated (§5.7, §5.9)', async () => {
    for (const choice of ['keep', 'delete'] as const) {
      const worker = await makeWorker(t.db, [f.paint], {
        name: `Leaving ${choice}`,
      });
      await issueIn('assigned', { workerId: worker.id });
      expect(
        (await dashboard()).byWorker.some((w) => w.worker.id === worker.id),
      ).toBe(true);

      await del(`${WORKERS}/${worker.id}?issues=${choice}`).expect(200);

      expect(await t.db.worker.count({ where: { id: worker.id } })).toBe(0);
      expect(
        await t.db.workerCategory.count({ where: { workerId: worker.id } }),
      ).toBe(0);
      expect(await t.db.category.count({ where: { id: f.paint } })).toBe(1);
      await get(`${WORKERS}/${worker.id}`).expect(404);
      const list = (await get(`${WORKERS}?active=all`).expect(200))
        .body as Body<Worker[]>;
      expect(list.data.some((w) => w.id === worker.id)).toBe(false);
      expect(
        (await dashboard()).byWorker.some((w) => w.worker.id === worker.id),
      ).toBe(false);
    }
  });

  it('Invalid `issues` value → 400; unknown id → 404 (contract)', async () => {
    await issueIn('assigned');
    await del(`${WORKERS}/${f.painter}?issues=everything`).expect(400);
    expect(await t.db.worker.count({ where: { id: f.painter } })).toBe(1);
    await del(`${WORKERS}/${randomUUID()}?issues=keep`).expect(404);
    await del(`${WORKERS}/${randomUUID()}`).expect(404);
    await request(t.http).delete(`${WORKERS}/${f.painter}`).expect(401);
  });
});
