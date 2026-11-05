import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DomainErrorCode, ErrorCode, type Category } from '@muayana/shared';
import {
  makeCategory,
  makeIssue,
  makeSite,
  makeWorker,
  resetDomainData,
} from './helpers/domain-data';
import {
  bearer,
  createEngineer,
  createTestApp,
  type TestApp,
} from './helpers/test-app';

const CATEGORIES = '/api/v1/categories';

describe('Categories (e2e)', () => {
  let t: TestApp;
  let auth: string;

  beforeAll(async () => {
    t = await createTestApp();
    auth = bearer((await createEngineer(t)).token);
  });
  afterAll(async () => {
    await t?.close();
  });
  beforeEach(() => resetDomainData(t.db));

  const list = async (query = '') =>
    (
      await request(t.http)
        .get(`${CATEGORIES}${query}`)
        .set('Authorization', auth)
        .expect(200)
    ).body.data as Category[];
  const post = (body: object) =>
    request(t.http).post(CATEGORIES).set('Authorization', auth).send(body);
  const patch = (id: string, body: object) =>
    request(t.http)
      .patch(`${CATEGORIES}/${id}`)
      .set('Authorization', auth)
      .send(body);
  const del = (id: string) =>
    request(t.http).delete(`${CATEGORIES}/${id}`).set('Authorization', auth);
  const reorder = (ids: unknown) =>
    request(t.http)
      .put(`${CATEGORIES}/order`)
      .set('Authorization', auth)
      .send({ ids });

  it('needs a token', async () => {
    await request(t.http).get(CATEGORIES).expect(401);
  });

  it('creates at the end of the order with zero counts', async () => {
    await makeCategory(t.db, 'نقاشة', { sortOrder: 4 });
    const res = await post({
      nameAr: ' كهرباء ',
      nameEn: 'Electrical',
      color: '#AABBCC',
    }).expect(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      nameAr: 'كهرباء',
      nameEn: 'Electrical',
      color: '#AABBCC',
      sortOrder: 5,
      active: true,
      counts: { open: 0, workers: 0 },
    });
  });

  it('Duplicate category nameAr ignoring case/space → 409 (§3)', async () => {
    await post({ nameAr: 'Paint  Work', color: '#000000' }).expect(201);
    const dup = await post({ nameAr: ' paint work', color: '#111111' }).expect(
      409,
    );
    expect(dup.body.error).toBe(DomainErrorCode.DUPLICATE);

    const other = await makeCategory(t.db, 'سباكة');
    const rename = await patch(other.id, { nameAr: 'PAINT WORK' }).expect(409);
    expect(rename.body.error).toBe(DomainErrorCode.DUPLICATE);
  });

  it('Delete category used by an issue or worker → 409; unused → ok (§6.8)', async () => {
    const site = await makeSite(t.db);
    const onIssue = await makeCategory(t.db, 'على مشكلة');
    await makeIssue(t.db, {
      siteId: site.id,
      status: 'unassigned',
      categoryId: onIssue.id,
    });
    const onWorker = await makeCategory(t.db, 'مع عامل');
    await makeWorker(t.db, [onWorker.id]);
    const unused = await makeCategory(t.db, 'غير مستخدمة');

    for (const used of [onIssue, onWorker]) {
      const res = await del(used.id).expect(409);
      expect(res.body.error).toBe(DomainErrorCode.IN_USE);
    }
    expect((await del(unused.id).expect(200)).body.data).toEqual({
      id: unused.id,
    });
    expect(await t.db.category.count()).toBe(2);
  });

  it('Deactivated category hidden with active=true (§3)', async () => {
    const a = await makeCategory(t.db, 'أ', { sortOrder: 0 });
    const b = await makeCategory(t.db, 'ب', { sortOrder: 1 });
    const res = await patch(b.id, { active: false }).expect(200);
    expect(res.body.data.active).toBe(false);

    expect((await list()).map((c) => c.id)).toEqual([a.id]);
    expect((await list('?active=true')).map((c) => c.id)).toEqual([a.id]);
    expect((await list('?active=all')).map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it('Deactivated category stays on existing issues and workers (§3, §6.11)', async () => {
    const site = await makeSite(t.db);
    const cat = await makeCategory(t.db, 'دهان');
    const worker = await makeWorker(t.db, [cat.id]);
    const issue = await makeIssue(t.db, {
      siteId: site.id,
      status: 'assigned',
      categoryId: cat.id,
      workerId: worker.id,
    });
    await patch(cat.id, { active: false }).expect(200);

    expect(
      (await t.db.issue.findUniqueOrThrow({ where: { id: issue.id } }))
        .categoryId,
    ).toBe(cat.id);
    const w = await request(t.http)
      .get(`/api/v1/workers/${worker.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(w.body.data.categories.map((c: { id: string }) => c.id)).toEqual([
      cat.id,
    ]);
    const all = await list('?active=all');
    expect(all[0].counts).toEqual({ open: 1, workers: 1 });
  });

  it('counts open issues (not new/solved/cancelled) and active workers', async () => {
    const site = await makeSite(t.db);
    const cat = await makeCategory(t.db);
    const worker = await makeWorker(t.db, [cat.id]);
    await makeWorker(t.db, [cat.id], { active: false });
    for (const status of ['unassigned', 'solved', 'cancelled'] as const)
      await makeIssue(t.db, {
        siteId: site.id,
        status,
        categoryId: cat.id,
        workerId: status === 'solved' ? worker.id : null,
      });
    await makeIssue(t.db, {
      siteId: site.id,
      status: 'sent',
      categoryId: cat.id,
      workerId: worker.id,
    });
    expect((await list())[0].counts).toEqual({ open: 2, workers: 1 });
  });

  it('Reorder with missing/unknown ids → 400 (contract)', async () => {
    const a = await makeCategory(t.db, 'أ', { sortOrder: 0 });
    const b = await makeCategory(t.db, 'ب', { sortOrder: 1 });
    const c = await makeCategory(t.db, 'ج', { sortOrder: 2, active: false });

    for (const ids of [
      [a.id, b.id], // missing one (the inactive one counts too)
      [a.id, b.id, randomUUID()], // unknown
      [a.id, b.id, c.id, randomUUID()], // extra unknown
      [a.id, a.id, b.id], // duplicate
      [],
      ['not-a-uuid'],
    ]) {
      const res = await reorder(ids).expect(400);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    }

    const ok = await reorder([c.id, a.id, b.id]).expect(200);
    expect((ok.body.data as Category[]).map((x) => [x.id, x.sortOrder])).toEqual(
      [
        [c.id, 0],
        [a.id, 1],
        [b.id, 2],
      ],
    );
    expect((await list()).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('Color not #RRGGBB → 400; name 61 chars → 400; name 60 → ok (contract)', async () => {
    for (const color of ['#abc', 'red', '#GGGGGG', '#1234567', ''])
      await post({ nameAr: 'لون', color }).expect(400);
    await post({ nameAr: 'x'.repeat(61), color: '#000000' }).expect(400);
    await post({
      nameAr: 'y'.repeat(10),
      nameEn: 'z'.repeat(61),
      color: '#000000',
    }).expect(400);
    await post({ nameAr: 'x'.repeat(60), color: '#000000' }).expect(201);
    await post({ nameAr: '  ', color: '#000000' }).expect(400);
  });

  it('Unknown id → 404 (PATCH, DELETE)', async () => {
    const id = randomUUID();
    await patch(id, { color: '#000000' }).expect(404);
    await del(id).expect(404);
  });
});
