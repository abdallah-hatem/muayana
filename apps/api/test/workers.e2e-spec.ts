import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  CSV_BOM,
  DomainErrorCode,
  ErrorCode,
  type Worker,
} from '@muayana/shared';
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

const WORKERS = '/api/v1/workers';
const EXPORT = `${WORKERS}/export.csv`;

describe('Workers (e2e)', () => {
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
    request(t.http).post(WORKERS).set('Authorization', auth).send(body);
  const patch = (id: string, body: object) =>
    request(t.http)
      .patch(`${WORKERS}/${id}`)
      .set('Authorization', auth)
      .send(body);
  const del = (id: string) =>
    request(t.http).delete(`${WORKERS}/${id}`).set('Authorization', auth);
  const ids = (res: request.Response) =>
    (res.body.data as Worker[]).map((w) => w.id);
  const csv = (query = '') =>
    get(`${EXPORT}${query}`)
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => done(null, text));
      });

  it('needs a token (list and CSV)', async () => {
    await request(t.http).get(WORKERS).expect(401);
    await request(t.http).get(EXPORT).expect(401);
  });

  it('creates a worker with his categories in display order and zero counts', async () => {
    const b = await makeCategory(t.db, 'ب', { sortOrder: 2 });
    const a = await makeCategory(t.db, 'أ', { sortOrder: 1 });
    const res = await post({
      name: ' Ahmed ',
      phone: '010 1234 5678',
      categoryIds: [b.id, a.id, b.id],
      notes: 'fast',
    }).expect(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      name: 'Ahmed',
      phone: '+201012345678',
      notes: 'fast',
      active: true,
      categories: [
        { id: a.id, nameAr: 'أ', nameEn: null, color: '#336699' },
        { id: b.id, nameAr: 'ب', nameEn: null, color: '#336699' },
      ],
      counts: {
        assigned: 0,
        sent: 0,
        estimated: 0,
        in_progress: 0,
        solved: 0,
        cancelled: 0,
        open: 0,
        overdue: 0,
      },
    });
  });

  it('Create with no categories → 400 (§3)', async () => {
    for (const body of [
      { name: 'A', phone: '01012345678', categoryIds: [] },
      { name: 'A', phone: '01012345678' },
    ]) {
      const res = await post(body).expect(400);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    }
    const unknown = await post({
      name: 'A',
      phone: '01012345678',
      categoryIds: [randomUUID()],
    }).expect(400);
    expect(unknown.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    expect(await t.db.worker.count()).toBe(0);
  });

  it('Create with inactive category → 409 INACTIVE_CATEGORY (§6.11)', async () => {
    const on = await makeCategory(t.db, 'نشطة');
    const off = await makeCategory(t.db, 'متوقفة', { active: false });
    const res = await post({
      name: 'A',
      phone: '01012345678',
      categoryIds: [on.id, off.id],
    }).expect(409);
    expect(res.body.error).toBe(DomainErrorCode.INACTIVE_CATEGORY);
    expect(await t.db.worker.count()).toBe(0);
  });

  it('Local phone stored as +20…; duplicate phone (in another format) → 409 (§3)', async () => {
    const cat = await makeCategory(t.db);
    const first = await post({
      name: 'A',
      phone: '٠١٠١٢٣٤٥٦٧٨',
      categoryIds: [cat.id],
    }).expect(201);
    expect(first.body.data.phone).toBe('+201012345678');

    for (const phone of [
      '+20 10 1234 5678',
      '0020-101-234-5678',
      '01012345678',
    ]) {
      const dup = await post({
        name: 'B',
        phone,
        categoryIds: [cat.id],
      }).expect(409);
      expect(dup.body.error).toBe(DomainErrorCode.DUPLICATE);
    }

    const second = await post({
      name: 'B',
      phone: '01112345678',
      categoryIds: [cat.id],
    }).expect(201);
    const change = await patch(second.body.data.id, {
      phone: '+201012345678',
    }).expect(409);
    expect(change.body.error).toBe(DomainErrorCode.DUPLICATE);
    // Saving his own phone in another format is not a duplicate of himself.
    await patch(second.body.data.id, { phone: '011 1234 5678' }).expect(200);
  });

  it('Bad phone → 400 (contract)', async () => {
    const cat = await makeCategory(t.db);
    for (const phone of ['12345', '+966501234567', 'abc', ''])
      await post({ name: 'A', phone, categoryIds: [cat.id] }).expect(400);
  });

  it('Delete worker with issues → 409; deactivate instead → ok, keeps issues (§6.8)', async () => {
    const site = await makeSite(t.db);
    const cat = await makeCategory(t.db);
    const busy = await makeWorker(t.db, [cat.id]);
    const issue = await makeIssue(t.db, {
      siteId: site.id,
      status: 'assigned',
      categoryId: cat.id,
      workerId: busy.id,
    });

    const res = await del(busy.id).expect(409);
    expect(res.body.error).toBe(DomainErrorCode.IN_USE);

    const off = await patch(busy.id, { active: false }).expect(200);
    expect(off.body.data.active).toBe(false);
    expect(off.body.data.counts.assigned).toBe(1);
    expect(
      (await t.db.issue.findUniqueOrThrow({ where: { id: issue.id } }))
        .workerId,
    ).toBe(busy.id);

    const idle = await makeWorker(t.db, [cat.id]);
    expect((await del(idle.id).expect(200)).body.data).toEqual({ id: idle.id });
    expect(await t.db.worker.count({ where: { id: idle.id } })).toBe(0);
    // His category links went with him; the category itself stays.
    expect(await t.db.category.count({ where: { id: cat.id } })).toBe(1);
  });

  it('Deactivated worker keeps his issues and they still show him (§3, §6.11)', async () => {
    const site = await makeSite(t.db);
    const cat = await makeCategory(t.db);
    const worker = await makeWorker(t.db, [cat.id]);
    await makeIssue(t.db, {
      siteId: site.id,
      status: 'in_progress',
      categoryId: cat.id,
      workerId: worker.id,
    });
    await patch(worker.id, { active: false }).expect(200);

    // Hidden from the default (active) list, still there with active=false/all.
    expect(ids(await get(WORKERS).expect(200))).toEqual([]);
    expect(ids(await get(`${WORKERS}?active=false`).expect(200))).toEqual([
      worker.id,
    ]);
    const shown = await get(`${WORKERS}/${worker.id}`).expect(200);
    expect(shown.body.data.counts).toMatchObject({ in_progress: 1, open: 1 });
    const onIssue = await t.db.issue.findFirstOrThrow({
      where: { siteId: site.id },
      select: { worker: { select: { id: true, name: true } } },
    });
    expect(onIssue.worker).toEqual({ id: worker.id, name: worker.name });
  });

  it('Removing a category from a worker leaves his assigned issues untouched (§3)', async () => {
    const site = await makeSite(t.db);
    const paint = await makeCategory(t.db, 'نقاشة', { sortOrder: 0 });
    const elec = await makeCategory(t.db, 'كهرباء', { sortOrder: 1 });
    const worker = await makeWorker(t.db, [paint.id, elec.id]);
    const issue = await makeIssue(t.db, {
      siteId: site.id,
      status: 'sent',
      categoryId: elec.id,
      workerId: worker.id,
    });

    const res = await patch(worker.id, { categoryIds: [paint.id] }).expect(200);
    expect(res.body.data.categories.map((c: { id: string }) => c.id)).toEqual([
      paint.id,
    ]);
    const after = await t.db.issue.findUniqueOrThrow({
      where: { id: issue.id },
    });
    expect(after).toMatchObject({
      status: 'sent',
      categoryId: elec.id,
      workerId: worker.id,
    });
  });

  it('PATCH categoryIds [] → 400 (§3 at least one)', async () => {
    const cat = await makeCategory(t.db);
    const worker = await makeWorker(t.db, [cat.id]);
    const res = await patch(worker.id, { categoryIds: [] }).expect(400);
    expect(res.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    expect(
      await t.db.workerCategory.count({ where: { workerId: worker.id } }),
    ).toBe(1);
  });

  it('PATCH keeps a category he already has after it was deactivated; adding a deactivated one → 409', async () => {
    const kept = await makeCategory(t.db, 'قديمة', { sortOrder: 0 });
    const other = await makeCategory(t.db, 'أخرى', { sortOrder: 1 });
    const worker = await makeWorker(t.db, [kept.id]);
    await t.db.category.updateMany({ data: { active: false } });

    const ok = await patch(worker.id, {
      categoryIds: [kept.id],
      name: 'Renamed',
    }).expect(200);
    expect(ok.body.data.name).toBe('Renamed');

    const res = await patch(worker.id, {
      categoryIds: [kept.id, other.id],
    }).expect(409);
    expect(res.body.error).toBe(DomainErrorCode.INACTIVE_CATEGORY);
  });

  it('Counts per status + overdue correct (§5.7)', async () => {
    const site = await makeSite(t.db);
    const cat = await makeCategory(t.db);
    const worker = await makeWorker(t.db, [cat.id]);
    const other = await makeWorker(t.db, [cat.id]);
    const yesterday = cairoDate(t.clock.now(), -1);
    const give = (
      status:
        | 'assigned'
        | 'sent'
        | 'estimated'
        | 'in_progress'
        | 'solved'
        | 'cancelled',
      estimatedDate: string | null = null,
      workerId = worker.id,
    ) =>
      makeIssue(t.db, {
        siteId: site.id,
        status,
        categoryId: cat.id,
        workerId,
        estimatedDate,
      });
    await give('assigned');
    await give('assigned');
    await give('sent');
    await give('estimated', yesterday); // overdue
    await give('estimated', cairoDate(t.clock.now(), 3));
    await give('in_progress', yesterday); // overdue
    await give('solved', yesterday); // closed: not overdue, not open
    await give('cancelled');
    await give('sent', null, other.id);

    const res = await get(`${WORKERS}/${worker.id}`).expect(200);
    expect(res.body.data.counts).toEqual({
      assigned: 2,
      sent: 1,
      estimated: 2,
      in_progress: 1,
      solved: 1,
      cancelled: 1,
      open: 6,
      overdue: 2,
    });
    const list = await get(WORKERS).expect(200);
    const listed = (list.body.data as Worker[]).find((w) => w.id === worker.id);
    expect(listed?.counts).toEqual(res.body.data.counts);
  });

  it('Filter by categoryId, search by name/phone (§5.7)', async () => {
    const paint = await makeCategory(t.db, 'نقاشة');
    const elec = await makeCategory(t.db, 'كهرباء');
    const ahmed = (
      await post({
        name: 'Ahmed Saber',
        phone: '01012345678',
        categoryIds: [paint.id],
      }).expect(201)
    ).body.data as Worker;
    const mona = (
      await post({
        name: 'Mona',
        phone: '01198765432',
        categoryIds: [paint.id, elec.id],
      }).expect(201)
    ).body.data as Worker;

    expect(
      ids(await get(`${WORKERS}?categoryId=${elec.id}`).expect(200)),
    ).toEqual([mona.id]);
    expect(
      ids(await get(`${WORKERS}?categoryId=${paint.id}`).expect(200)),
    ).toEqual([ahmed.id, mona.id]);
    expect(ids(await get(`${WORKERS}?search=saber`).expect(200))).toEqual([
      ahmed.id,
    ]);
    // Local format, international digits and Arabic-Indic digits all find the phone.
    for (const search of ['0119876', '2011987', '٠١١٩٨٧'])
      expect(
        ids(
          await get(`${WORKERS}?search=${encodeURIComponent(search)}`).expect(
            200,
          ),
        ),
      ).toEqual([mona.id]);
    expect(
      ids(
        await get(`${WORKERS}?search=saber&categoryId=${elec.id}`).expect(200),
      ),
    ).toEqual([]);
    await get(`${WORKERS}?categoryId=nope`).expect(400);

    const paged = await get(`${WORKERS}?limit=1`).expect(200);
    expect(paged.body.meta).toMatchObject({ total: 2, hasNextPage: true });
  });

  it('Workers CSV: BOM, header language, formula-escaped notes, matches the filter (§7)', async () => {
    const site = await makeSite(t.db);
    const paint = await makeCategory(t.db, 'نقاشة', { sortOrder: 0 });
    await t.db.category.update({
      where: { id: paint.id },
      data: { nameEn: 'Painting' },
    });
    const elec = await makeCategory(t.db, 'كهرباء', { sortOrder: 1 });
    const ahmed = (
      await post({
        name: 'Ahmed',
        phone: '01012345678',
        categoryIds: [paint.id],
        notes: '=HYPERLINK("http://x")',
      }).expect(201)
    ).body.data as Worker;
    await post({
      name: 'Mona',
      phone: '01198765432',
      categoryIds: [elec.id],
    }).expect(201);
    await makeIssue(t.db, {
      siteId: site.id,
      status: 'sent',
      categoryId: paint.id,
      workerId: ahmed.id,
      estimatedDate: cairoDate(t.clock.now(), -2),
    });

    const ar = await csv(`?categoryId=${paint.id}`).expect(200);
    expect(ar.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(ar.headers['content-disposition']).toBe(
      'attachment; filename="workers.csv"',
    );
    const arText = ar.body as string;
    expect(arText.startsWith(CSV_BOM)).toBe(true);
    const arLines = arText.slice(1).trimEnd().split('\r\n');
    expect(arLines[0]).toBe(
      'الاسم,الهاتف,التخصصات,نشط,ملاحظات,مُسند,أُرسل للمقاول,تم تحديد موعد,جاري العمل,تم الحل,مفتوح,متأخر',
    );
    // Only Ahmed matches the filter; his notes are formula-guarded; counts per status.
    expect(arLines).toHaveLength(2);
    expect(arLines[1]).toBe(
      `Ahmed,'+201012345678,نقاشة,نعم,"'=HYPERLINK(""http://x"")",0,1,0,0,0,1,1`,
    );

    const en = await csv(`?lang=en&categoryId=${paint.id}`).expect(200);
    const enLines = (en.body as string).slice(1).trimEnd().split('\r\n');
    expect(enLines[0]).toBe(
      'Name,Phone,Categories,Active,Notes,Assigned,Sent,Estimated,In progress,Solved,Open,Overdue',
    );
    expect(enLines[1]).toContain(',Painting,Yes,');

    // No filter → both active workers, sorted by name.
    const all = await csv('?lang=en').expect(200);
    const allLines = (all.body as string).slice(1).trimEnd().split('\r\n');
    expect(allLines.slice(1).map((l) => l.split(',')[0])).toEqual([
      'Ahmed',
      'Mona',
    ]);

    // Bad filter values are a 400 envelope, not a CSV; paging is not a CSV filter.
    const bad = await get(`${EXPORT}?lang=fr`).expect(400);
    expect(bad.headers['content-type']).toMatch(/^application\/json/);
    expect(bad.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    await get(`${EXPORT}?page=2`).expect(400);
  });

  it('Unknown id → 404 (GET, PATCH, DELETE)', async () => {
    const id = randomUUID();
    await get(`${WORKERS}/${id}`).expect(404);
    await patch(id, { name: 'x' }).expect(404);
    await del(id).expect(404);
  });
});
