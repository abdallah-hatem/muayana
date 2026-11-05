import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DomainErrorCode, ErrorCode, type Site } from '@muayana/shared';
import {
  cairoDate,
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

const SITES = '/api/v1/sites';

describe('Sites (e2e)', () => {
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

  const get = (path: string) =>
    request(t.http).get(path).set('Authorization', auth);
  const post = (body: object) =>
    request(t.http).post(SITES).set('Authorization', auth).send(body);
  const patch = (id: string, body: object) =>
    request(t.http).patch(`${SITES}/${id}`).set('Authorization', auth).send(body);
  const del = (id: string) =>
    request(t.http).delete(`${SITES}/${id}`).set('Authorization', auth);

  it('needs a token', async () => {
    await request(t.http).get(SITES).expect(401);
  });

  it('creates a site, trimming the name and clearing blank notes', async () => {
    const res = await post({
      name: '  Tower A ',
      address: 'Cairo',
      notes: '  ',
    }).expect(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      name: 'Tower A',
      address: 'Cairo',
      notes: null,
      archived: false,
      createdAt: expect.any(String),
      nextNumber: 1,
      counts: { open: 0, new: 0, overdue: 0, total: 0 },
    });
  });

  it('Duplicate site name (different case/spaces) among non-archived → 409; same name as archived → allowed', async () => {
    await post({ name: 'Tower  A' }).expect(201);
    const dup = await post({ name: ' tower a ' }).expect(409);
    expect(dup.body.error).toBe(DomainErrorCode.DUPLICATE);

    await makeSite(t.db, 'Old Block', true);
    await post({ name: 'old block' }).expect(201);
  });

  it('Duplicate site name: two concurrent creates of one name → exactly one wins', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post({ name: 'Race Site' })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await t.db.site.count({ where: { nameKey: 'race site' } })).toBe(1);
  });

  it('Duplicate site name on rename → 409; renaming to its own name in another case → ok', async () => {
    const a = await makeSite(t.db, 'Alpha');
    await makeSite(t.db, 'Beta');
    const res = await patch(a.id, { name: 'BETA' }).expect(409);
    expect(res.body.error).toBe(DomainErrorCode.DUPLICATE);
    const ok = await patch(a.id, { name: 'ALPHA' }).expect(200);
    expect(ok.body.data.name).toBe('ALPHA');
  });

  it('Unarchive a site into a name now used by another active site → 409', async () => {
    const old = await makeSite(t.db, 'Gamma', true);
    await makeSite(t.db, 'gamma');
    const res = await patch(old.id, { archived: false }).expect(409);
    expect(res.body.error).toBe(DomainErrorCode.DUPLICATE);
    // Archiving it again (or keeping it archived) is never refused.
    await patch(old.id, { notes: 'still archived' }).expect(200);
  });

  it('Delete site with issues → 409 IN_USE; without → ok (§6.8)', async () => {
    const used = await makeSite(t.db, 'Used');
    await makeIssue(t.db, { siteId: used.id });
    const res = await del(used.id).expect(409);
    expect(res.body.error).toBe(DomainErrorCode.IN_USE);
    expect(await t.db.site.count({ where: { id: used.id } })).toBe(1);

    const empty = await makeSite(t.db, 'Empty');
    const ok = await del(empty.id).expect(200);
    expect(ok.body.data).toEqual({ id: empty.id });
    expect(await t.db.site.count({ where: { id: empty.id } })).toBe(0);
  });

  it('Archived sites hidden by default, shown with archived=all', async () => {
    await makeSite(t.db, 'Live');
    await makeSite(t.db, 'Gone', true);
    const names = (res: request.Response) =>
      (res.body.data as Site[]).map((s) => s.name);

    expect(names(await get(SITES).expect(200))).toEqual(['Live']);
    expect(names(await get(`${SITES}?archived=all`).expect(200))).toEqual([
      'Live',
      'Gone',
    ]);
    expect(names(await get(`${SITES}?archived=true`).expect(200))).toEqual([
      'Gone',
    ]);
    await get(`${SITES}?archived=maybe`).expect(400);
  });

  it('Site counts: open/new/overdue correct (§5.9)', async () => {
    const site = await makeSite(t.db, 'Counted');
    const other = await makeSite(t.db, 'Other');
    const cat = await makeCategory(t.db);
    const worker = await makeWorker(t.db, [cat.id]);
    const now = t.clock.now();
    const yesterday = cairoDate(now, -1);
    const today = cairoDate(now, 0);
    const on = (status: Parameters<typeof makeIssue>[1]['status'], extra = {}) =>
      makeIssue(t.db, {
        siteId: site.id,
        status,
        categoryId: status === 'new' ? null : cat.id,
        workerId: ['new', 'unassigned', 'cancelled'].includes(status!)
          ? null
          : worker.id,
        ...extra,
      });
    await on('new');
    await on('new');
    await on('unassigned');
    await on('estimated', { estimatedDate: yesterday }); // overdue
    await on('in_progress', { estimatedDate: today }); // due today: not overdue
    await on('solved', { estimatedDate: yesterday }); // closed: never overdue
    await on('cancelled');
    await makeIssue(t.db, { siteId: other.id });

    const res = await get(`${SITES}/${site.id}`).expect(200);
    expect(res.body.data.counts).toEqual({
      open: 3,
      new: 2,
      overdue: 1,
      total: 7,
    });
    expect(res.body.data.nextNumber).toBe(8);

    const list = await get(SITES).expect(200);
    const counted = (list.body.data as Site[]).find((s) => s.id === site.id);
    expect(counted?.counts).toEqual(res.body.data.counts);

    // A day later the in-progress issue (due today) is overdue too.
    t.clock.advance(24 * 60 * 60 * 1000);
    const later = await get(`${SITES}/${site.id}`).expect(200);
    expect(later.body.data.counts.overdue).toBe(2);
  });

  it('searches name and address, and pages with meta', async () => {
    await post({ name: 'Nile Tower', address: 'Zamalek' }).expect(201);
    await post({ name: 'Palm', address: 'nile corniche' }).expect(201);
    await post({ name: 'Desert' }).expect(201);

    const res = await get(`${SITES}?search=NILE&limit=1&page=2`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({
      total: 2,
      page: 2,
      limit: 1,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    await get(`${SITES}?limit=101`).expect(400);
  });

  it('Name 121 chars → 400; 120 → ok; empty name → 400 (contract)', async () => {
    const tooLong = await post({ name: 'x'.repeat(121) }).expect(400);
    expect(tooLong.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    await post({ name: 'x'.repeat(120) }).expect(201);
    await post({ name: '   ' }).expect(400);
    await post({ name: 'Ok', unknown: 1 }).expect(400);
  });

  it('Unknown id → 404 (GET, PATCH, DELETE)', async () => {
    const id = randomUUID();
    await get(`${SITES}/${id}`).expect(404);
    await patch(id, { name: 'x' }).expect(404);
    await del(id).expect(404);
    await get(`${SITES}/not-a-uuid`).expect(400);
  });
});
