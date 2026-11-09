import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import {
  DomainErrorCode,
  ErrorCode,
  PHOTO_MAX_BYTES,
  nameKey,
  type Issue,
  type IssueDetail,
  type IssueStatus,
} from '@muayana/shared';
import {
  bearer,
  createEngineer,
  createTestApp,
  type Engineer,
  type TestApp,
} from './helpers/test-app';

/*
 * Issues API (plan T6). One test per planned edge case, named after it.
 */

const ISSUES = '/api/v1/issues';

let t: TestApp;
let engineer: Engineer;

/** Fixture ids, made in beforeAll. */
const f = {
  site: '',
  site2: '',
  archivedSite: '',
  paint: '',
  elec: '',
  inactiveCat: '',
  wPaint: '',
  wElec: '',
  wBoth: '',
  wInactive: '',
};

let jpeg: Buffer;
let png: Buffer;

const auth = () => ({ Authorization: bearer(engineer.token) });
type Body<T> = { data: T; error?: string; meta?: Record<string, unknown> };

async function cleanDb(): Promise<void> {
  await t.db.issue.deleteMany();
  await t.db.workerCategory.deleteMany();
  await t.db.worker.deleteMany();
  await t.db.site.deleteMany();
  await t.db.category.deleteMany();
}

async function makeSite(name: string, archived = false): Promise<string> {
  const row = await t.db.site.create({
    data: { name, nameKey: nameKey(name), archived },
  });
  return row.id;
}

async function makeCategory(name: string, active = true): Promise<string> {
  const row = await t.db.category.create({
    data: { nameAr: name, nameKey: nameKey(name), color: '#123456', active },
  });
  return row.id;
}

let phoneSeq = 100;
async function makeWorker(
  name: string,
  categoryIds: string[],
  active = true,
): Promise<string> {
  const row = await t.db.worker.create({
    data: {
      name,
      phone: `+20100000${phoneSeq++}`,
      active,
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
  return row.id;
}

// ------------------------------------------------------------- API helpers

const post = (path: string) => request(t.http).post(path).set(auth());

function upload(
  fields: Record<string, string>,
  photo: Buffer | null = jpeg,
  contentType = 'image/jpeg',
) {
  const req = post(ISSUES);
  for (const [k, v] of Object.entries(fields)) void req.field(k, v);
  if (photo)
    void req.attach('photo', photo, { filename: 'p.jpg', contentType });
  return req;
}

async function createIssue(
  over: Partial<
    Record<'id' | 'siteId' | 'capturedAt' | 'description' | 'location', string>
  > = {},
): Promise<Issue> {
  const res = await upload({
    id: randomUUID(),
    siteId: f.site,
    capturedAt: new Date().toISOString(),
    ...over,
  }).expect(201);
  return (res.body as Body<Issue>).data;
}

const patch = (id: string, body: object) =>
  request(t.http).patch(`${ISSUES}/${id}`).set(auth()).send(body);

const move = (id: string, body: object) =>
  post(`${ISSUES}/${id}/status`).send(body);

const addPhoto = (id: string, kind: 'before' | 'after', photo = jpeg) =>
  post(`${ISSUES}/${id}/photos`)
    .field('kind', kind)
    .attach('photo', photo, { filename: 'p.jpg', contentType: 'image/jpeg' });

const getIssue = async (id: string): Promise<IssueDetail> =>
  (
    (await request(t.http).get(`${ISSUES}/${id}`).set(auth()).expect(200))
      .body as Body<IssueDetail>
  ).data;

const list = async (query: Record<string, string | number>) => {
  const res = await request(t.http)
    .get(ISSUES)
    .query(query)
    .set(auth())
    .expect(200);
  return res.body as Body<Issue[]>;
};

const historyCount = (issueId: string) =>
  t.db.statusChange.count({ where: { issueId } });

/** A sorted issue with a worker: `assigned` (paint, wPaint) unless moved on. */
async function assignedIssue(
  over: Parameters<typeof createIssue>[0] = {},
  worker = f.wPaint,
): Promise<Issue> {
  const issue = await createIssue(over);
  await patch(issue.id, {
    categoryId: f.paint,
    description: 'Crack in wall',
    workerId: worker,
  }).expect(200);
  return issue;
}

async function issueIn(
  status: IssueStatus,
  over: Parameters<typeof createIssue>[0] = {},
): Promise<Issue> {
  const issue = await assignedIssue(over);
  if (status === 'assigned') return issue;
  const body: Record<string, string> = { status };
  if (status === 'estimated') body.estimatedDate = '2099-01-01';
  await move(issue.id, body).expect(200);
  return issue;
}

// ------------------------------------------------------------------ setup

beforeAll(async () => {
  t = await createTestApp();
  engineer = await createEngineer(t);
  await cleanDb();
  jpeg = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#c33' },
  })
    .jpeg()
    .toBuffer();
  png = await sharp({
    create: { width: 20, height: 50, channels: 3, background: '#3c3' },
  })
    .png()
    .toBuffer();
  f.site = await makeSite('Tower A');
  f.site2 = await makeSite('Tower B');
  f.archivedSite = await makeSite('Old Villa', true);
  f.paint = await makeCategory('نقاشة');
  f.elec = await makeCategory('كهرباء');
  f.inactiveCat = await makeCategory('قديم', false);
  f.wPaint = await makeWorker('Painter', [f.paint]);
  f.wElec = await makeWorker('Electrician', [f.elec]);
  f.wBoth = await makeWorker('Handyman', [f.paint, f.elec]);
  f.wInactive = await makeWorker('Retired', [f.paint], false);
});

afterAll(async () => {
  if (t) await cleanDb();
  await t?.close();
});

// ================================================================= create

describe('POST /issues', () => {
  it('create twice with same client id → one issue, second returns 200 same issue', async () => {
    const id = randomUUID();
    const fields = { id, siteId: f.site, capturedAt: new Date().toISOString() };
    const first = await upload(fields).expect(201);
    const second = await upload(fields).expect(200);
    const a = (first.body as Body<Issue>).data;
    const b = (second.body as Body<Issue>).data;
    expect(b.id).toBe(id);
    expect(b.number).toBe(a.number);
    expect(await t.db.issue.count({ where: { id } })).toBe(1);
    expect(await t.db.photo.count({ where: { issueId: id } })).toBe(1);
  });

  it('create twice with same client id at the same time → one issue', async () => {
    const id = randomUUID();
    const fields = { id, siteId: f.site, capturedAt: new Date().toISOString() };
    const results = await Promise.all([upload(fields), upload(fields)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await t.db.issue.count({ where: { id } })).toBe(1);
  });

  it('create on archived site → 409 ARCHIVED_SITE', async () => {
    const res = await upload({
      id: randomUUID(),
      siteId: f.archivedSite,
      capturedAt: new Date().toISOString(),
    }).expect(409);
    expect((res.body as Body<null>).error).toBe(DomainErrorCode.ARCHIVED_SITE);
  });

  it('create on unknown site → 404', async () => {
    await upload({
      id: randomUUID(),
      siteId: randomUUID(),
      capturedAt: new Date().toISOString(),
    }).expect(404);
  });

  it('create without photo → 400', async () => {
    const id = randomUUID();
    await upload(
      { id, siteId: f.site, capturedAt: new Date().toISOString() },
      null,
    ).expect(400);
    expect(await t.db.issue.count({ where: { id } })).toBe(0);
  });

  it('create with a non-image file → 400', async () => {
    const id = randomUUID();
    await upload(
      { id, siteId: f.site, capturedAt: new Date().toISOString() },
      Buffer.from('%PDF-1.7 not an image at all'),
      'image/jpeg',
    ).expect(400);
    expect(await t.db.issue.count({ where: { id } })).toBe(0);
  });

  it('create with a photo over 4MB → 413', async () => {
    const big = Buffer.alloc(PHOTO_MAX_BYTES + 1, 0);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    const id = randomUUID();
    await upload(
      { id, siteId: f.site, capturedAt: new Date().toISOString() },
      big,
    ).expect(413);
    expect(await t.db.issue.count({ where: { id } })).toBe(0);
  });

  it('create stores PNG/WebP as a JPEG with its width and height', async () => {
    const res = await upload(
      {
        id: randomUUID(),
        siteId: f.site,
        capturedAt: new Date().toISOString(),
      },
      png,
      'image/png',
    ).expect(201);
    const photo = (res.body as Body<Issue>).data.photos[0];
    expect(photo).toMatchObject({ kind: 'before', width: 20, height: 50 });
    expect(photo.url).toMatch(/\/issues\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/);
  });

  it('two concurrent creates on one site get different numbers', async () => {
    const site = await makeSite('Concurrency site');
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        upload({
          id: randomUUID(),
          siteId: site,
          capturedAt: new Date().toISOString(),
        }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results
      .map((r) => (r.body as Body<Issue>).data.number)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('numbers never reused after delete', async () => {
    const site = await makeSite('Numbering site');
    const one = await createIssue({ siteId: site });
    const two = await createIssue({ siteId: site });
    await request(t.http).delete(`${ISSUES}/${two.id}`).set(auth()).expect(200);
    const three = await createIssue({ siteId: site });
    expect([one.number, two.number, three.number]).toEqual([1, 2, 3]);
  });

  it('capturedAt from client kept', async () => {
    const capturedAt = '2026-01-15T07:45:12.000Z';
    const issue = await createIssue({ capturedAt });
    expect(issue.capturedAt).toBe(capturedAt);
    expect(issue.status).toBe('new');
    expect((await getIssue(issue.id)).capturedAt).toBe(capturedAt);
  });
});

// ======================================================= create with fields (N1)

describe('POST /issues with the capture sheet fields (N1)', () => {
  /** Uploads a capture with the sheet's fields; answers the response. */
  const capture = (fields: Record<string, string> = {}, siteId = f.site) => {
    const id = randomUUID();
    return {
      id,
      req: upload({
        id,
        siteId,
        capturedAt: new Date().toISOString(),
        ...fields,
      }),
    };
  };

  /** A refused capture left nothing behind: no issue, no photo, no history. */
  async function expectNothingCreated(id: string): Promise<void> {
    expect(await t.db.issue.count({ where: { id } })).toBe(0);
    expect(await t.db.photo.count({ where: { issueId: id } })).toBe(0);
    expect(await historyCount(id)).toBe(0);
  }

  const moves = async (id: string) =>
    (await getIssue(id)).history.map((h) => `${h.from ?? 'none'}→${h.to}`);

  it('Photo only → new, one history row (none→new)', async () => {
    const { id, req } = capture();
    const issue = ((await req.expect(201)).body as Body<Issue>).data;
    expect(issue.status).toBe('new');
    expect(await moves(id)).toEqual(['none→new']);
  });

  it('Photo + trade + description → unassigned, rows none→new, new→unassigned', async () => {
    const { id, req } = capture({
      categoryId: f.paint,
      description: 'Crack over the door',
      location: 'Lobby',
      priority: 'high',
    });
    const issue = ((await req.expect(201)).body as Body<Issue>).data;
    expect(issue).toMatchObject({
      status: 'unassigned',
      category: { id: f.paint },
      worker: null,
      description: 'Crack over the door',
      location: 'Lobby',
      priority: 'high',
      assignedAt: null,
    });
    expect(await moves(id)).toEqual(['none→new', 'new→unassigned']);
  });

  it('+ contractor of that trade → assigned, assignedAt set', async () => {
    const { req } = capture({
      categoryId: f.paint,
      description: 'Peeling paint',
      workerId: f.wPaint,
    });
    const issue = ((await req.expect(201)).body as Body<Issue>).data;
    expect(issue.status).toBe('assigned');
    expect(issue.worker?.id).toBe(f.wPaint);
    expect(issue.assignedAt).not.toBeNull();
  });

  it('Contractor lacking the trade → 409 WORKER_LACKS_CATEGORY, nothing created', async () => {
    const { id, req } = capture({
      categoryId: f.paint,
      description: 'Peeling paint',
      workerId: f.wElec,
    });
    const res = await req.expect(409);
    expect((res.body as Body<null>).error).toBe(
      DomainErrorCode.WORKER_LACKS_CATEGORY,
    );
    await expectNothingCreated(id);
  });

  it('Inactive contractor / inactive trade → 409, nothing created', async () => {
    const worker = capture({
      categoryId: f.paint,
      description: 'Peeling paint',
      workerId: f.wInactive,
    });
    const w = await worker.req.expect(409);
    expect((w.body as Body<null>).error).toBe(DomainErrorCode.INACTIVE_WORKER);
    await expectNothingCreated(worker.id);

    const trade = capture({ categoryId: f.inactiveCat, description: 'Old' });
    const c = await trade.req.expect(409);
    expect((c.body as Body<null>).error).toBe(
      DomainErrorCode.INACTIVE_CATEGORY,
    );
    await expectNothingCreated(trade.id);
  });

  it('Contractor without trade → 409 ISSUE_REQUIREMENTS, nothing created', async () => {
    const { id, req } = capture({
      description: 'Peeling paint',
      workerId: f.wPaint,
    });
    const res = await req.expect(409);
    expect((res.body as Body<null>).error).toBe(
      DomainErrorCode.ISSUE_REQUIREMENTS,
    );
    await expectNothingCreated(id);
  });

  it('Trade without description → stays new (no error)', async () => {
    const { id, req } = capture({ categoryId: f.paint });
    const issue = ((await req.expect(201)).body as Body<Issue>).data;
    expect(issue.status).toBe('new');
    expect(issue.category?.id).toBe(f.paint);
    expect(await moves(id)).toEqual(['none→new']);
  });

  it('Contractor + trade without description → 409 ISSUE_REQUIREMENTS, nothing created', async () => {
    const { id, req } = capture({ categoryId: f.paint, workerId: f.wPaint });
    const res = await req.expect(409);
    expect(res.body as Body<{ missing: string[] }>).toMatchObject({
      error: DomainErrorCode.ISSUE_REQUIREMENTS,
      data: { missing: ['description'] },
    });
    await expectNothingCreated(id);
  });

  it('Archived site with fields → 409 ARCHIVED_SITE, nothing created', async () => {
    const { id, req } = capture(
      { categoryId: f.paint, description: 'Crack', workerId: f.wPaint },
      f.archivedSite,
    );
    const res = await req.expect(409);
    expect((res.body as Body<null>).error).toBe(DomainErrorCode.ARCHIVED_SITE);
    await expectNothingCreated(id);
  });

  it('Unauthenticated POST /issues with the new fields → 401', async () => {
    const id = randomUUID();
    await request(t.http)
      .post(ISSUES)
      .field('id', id)
      .field('siteId', f.site)
      .field('capturedAt', new Date().toISOString())
      .field('categoryId', f.paint)
      .field('description', 'Crack')
      .field('workerId', f.wPaint)
      .attach('photo', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' })
      .expect(401);
    await expectNothingCreated(id);
  });

  it('assigned on create writes exactly none→new and new→assigned', async () => {
    const { id, req } = capture({
      categoryId: f.elec,
      description: 'Dead socket',
      workerId: f.wBoth,
    });
    await req.expect(201);
    expect(await moves(id)).toEqual(['none→new', 'new→assigned']);
    expect(await historyCount(id)).toBe(2);
  });

  it('Same client id twice with fields → one issue, same status', async () => {
    const id = randomUUID();
    const fields = {
      id,
      siteId: f.site,
      capturedAt: new Date().toISOString(),
      categoryId: f.paint,
      description: 'Crack',
      workerId: f.wPaint,
    };
    const first = ((await upload(fields).expect(201)).body as Body<Issue>).data;
    const second = ((await upload(fields).expect(200)).body as Body<Issue>)
      .data;
    expect(second).toMatchObject({
      id,
      number: first.number,
      status: 'assigned',
    });
    expect(await t.db.issue.count({ where: { id } })).toBe(1);
    expect(await historyCount(id)).toBe(2);
  });

  it('create with a bad priority or a non-uuid trade → 400, nothing created', async () => {
    const bad = capture({ priority: 'asap' });
    await bad.req.expect(400);
    await expectNothingCreated(bad.id);
    const notId = capture({ categoryId: 'paint' });
    await notId.req.expect(400);
    await expectNothingCreated(notId.id);
  });
});

// ================================================================= photos

describe('photos', () => {
  it('add 11th before-photo → 409 PHOTO_LIMIT', async () => {
    const issue = await createIssue();
    for (let i = 0; i < 9; i++) await addPhoto(issue.id, 'before').expect(201);
    const res = await addPhoto(issue.id, 'before').expect(409);
    expect((res.body as Body<null>).error).toBe(DomainErrorCode.PHOTO_LIMIT);
    expect(
      await t.db.photo.count({ where: { issueId: issue.id, kind: 'before' } }),
    ).toBe(10);
  });

  it('delete last before-photo → 409 LAST_PHOTO', async () => {
    const issue = await createIssue();
    const res = await request(t.http)
      .delete(`${ISSUES}/${issue.id}/photos/${issue.photos[0].id}`)
      .set(auth())
      .expect(409);
    expect((res.body as Body<null>).error).toBe(DomainErrorCode.LAST_PHOTO);
  });

  it('add 11th after-photo → 409; delete an after-photo → ok even if it is the last after-photo', async () => {
    const issue = await createIssue();
    for (let i = 0; i < 10; i++) await addPhoto(issue.id, 'after').expect(201);
    const refused = await addPhoto(issue.id, 'after').expect(409);
    expect((refused.body as Body<null>).error).toBe(
      DomainErrorCode.PHOTO_LIMIT,
    );

    const lone = await createIssue();
    const withAfter = (
      (await addPhoto(lone.id, 'after').expect(201)).body as Body<Issue>
    ).data;
    const after = withAfter.photos.find((p) => p.kind === 'after')!;
    const res = await request(t.http)
      .delete(`${ISSUES}/${lone.id}/photos/${after.id}`)
      .set(auth())
      .expect(200);
    expect((res.body as Body<Issue>).data.photos.map((p) => p.kind)).toEqual([
      'before',
    ]);
  });

  it('deleting a second before-photo is allowed', async () => {
    const issue = await createIssue();
    const added = (
      (await addPhoto(issue.id, 'before').expect(201)).body as Body<Issue>
    ).data;
    expect(added.photos).toHaveLength(2);
    await request(t.http)
      .delete(`${ISSUES}/${issue.id}/photos/${added.photos[1].id}`)
      .set(auth())
      .expect(200);
  });
});

// ============================================================ patch rules

describe('PATCH /issues/:id', () => {
  it('assign worker lacking the category → 409 WORKER_LACKS_CATEGORY', async () => {
    const issue = await createIssue();
    const res = await patch(issue.id, {
      categoryId: f.paint,
      description: 'Peeling paint',
      workerId: f.wElec,
    }).expect(409);
    expect((res.body as Body<null>).error).toBe(
      DomainErrorCode.WORKER_LACKS_CATEGORY,
    );
    expect((await getIssue(issue.id)).status).toBe('new');
  });

  it('assign inactive worker → 409 INACTIVE_WORKER', async () => {
    const issue = await createIssue();
    const res = await patch(issue.id, {
      categoryId: f.paint,
      description: 'Peeling paint',
      workerId: f.wInactive,
    }).expect(409);
    expect((res.body as Body<null>).error).toBe(
      DomainErrorCode.INACTIVE_WORKER,
    );
  });

  it('choose inactive category → 409 INACTIVE_CATEGORY', async () => {
    const issue = await createIssue();
    const res = await patch(issue.id, {
      categoryId: f.inactiveCat,
      description: 'Old trade',
    }).expect(409);
    expect((res.body as Body<null>).error).toBe(
      DomainErrorCode.INACTIVE_CATEGORY,
    );
  });

  it('sorting a new issue with category + description → unassigned; with a worker → assigned', async () => {
    const a = await createIssue();
    const sorted = (
      (await patch(a.id, { categoryId: f.paint, description: 'x' }).expect(200))
        .body as Body<Issue>
    ).data;
    expect(sorted.status).toBe('unassigned');
    const b = await assignedIssue();
    expect((await getIssue(b.id)).status).toBe('assigned');
  });

  it('PATCH category the worker lacks (API) → worker removed, status unassigned, one history row', async () => {
    const issue = await issueIn('sent');
    const before = await historyCount(issue.id);
    const res = await patch(issue.id, { categoryId: f.elec }).expect(200);
    const updated = (res.body as Body<Issue>).data;
    expect(updated.worker).toBeNull();
    expect(updated.status).toBe('unassigned');
    expect(updated.category?.id).toBe(f.elec);
    expect(await historyCount(issue.id)).toBe(before + 1);
  });

  it('PATCH workerId null on sent → unassigned, one history row', async () => {
    const issue = await issueIn('sent');
    const before = await historyCount(issue.id);
    const res = await patch(issue.id, { workerId: null }).expect(200);
    expect((res.body as Body<Issue>).data).toMatchObject({
      status: 'unassigned',
      worker: null,
    });
    expect(await historyCount(issue.id)).toBe(before + 1);
    const last = (await getIssue(issue.id)).history.at(-1);
    expect(last).toMatchObject({ from: 'sent', to: 'unassigned' });
  });

  it('PATCH categoryId null / description "" on non-new → 409; estimatedDate null on estimated → 409', async () => {
    const issue = await issueIn('assigned');
    const noCat = await patch(issue.id, { categoryId: null }).expect(409);
    expect((noCat.body as Body<null>).error).toBe(
      DomainErrorCode.ISSUE_REQUIREMENTS,
    );
    const noText = await patch(issue.id, { description: '   ' }).expect(409);
    expect((noText.body as Body<null>).error).toBe(
      DomainErrorCode.ISSUE_REQUIREMENTS,
    );
    const est = await issueIn('estimated');
    const noDate = await patch(est.id, { estimatedDate: null }).expect(409);
    expect((noDate.body as Body<null>).error).toBe(
      DomainErrorCode.ISSUE_REQUIREMENTS,
    );
  });

  it('PATCH different worker on in_progress → status kept', async () => {
    const issue = await issueIn('in_progress');
    const before = await historyCount(issue.id);
    const res = await patch(issue.id, { workerId: f.wBoth }).expect(200);
    expect((res.body as Body<Issue>).data).toMatchObject({
      status: 'in_progress',
      worker: { id: f.wBoth },
    });
    expect(await historyCount(issue.id)).toBe(before);
  });

  it('estimated date set on an assigned issue → estimated', async () => {
    const issue = await issueIn('assigned');
    const res = await patch(issue.id, { estimatedDate: '2099-02-03' }).expect(
      200,
    );
    expect((res.body as Body<Issue>).data).toMatchObject({
      status: 'estimated',
      estimatedDate: '2099-02-03',
    });
  });
});

// ================================================================= status

describe('POST /issues/:id/status', () => {
  it('every status move writes exactly one history row; patch with no status change writes none', async () => {
    const issue = await createIssue();
    expect(await historyCount(issue.id)).toBe(1); // created: null → new
    await patch(issue.id, {
      categoryId: f.paint,
      description: 'x',
      workerId: f.wPaint,
    }).expect(200); // new → assigned
    expect(await historyCount(issue.id)).toBe(2);
    await move(issue.id, { status: 'sent' }).expect(200);
    expect(await historyCount(issue.id)).toBe(3);
    await move(issue.id, { status: 'in_progress' }).expect(200);
    expect(await historyCount(issue.id)).toBe(4);
    await patch(issue.id, { location: 'Floor 2', priority: 'high' }).expect(
      200,
    );
    await patch(issue.id, { description: 'Bigger crack' }).expect(200);
    expect(await historyCount(issue.id)).toBe(4);
    await move(issue.id, { status: 'in_progress' }).expect(200); // same status: not a move
    expect(await historyCount(issue.id)).toBe(4);
  });

  it('status to new → 409 BACK_TO_NEW', async () => {
    const issue = await issueIn('assigned');
    const res = await move(issue.id, { status: 'new' }).expect(409);
    expect((res.body as Body<null>).error).toBe(DomainErrorCode.BACK_TO_NEW);
  });

  it('requirements unmet → 409 ISSUE_REQUIREMENTS', async () => {
    const fresh = await createIssue();
    const unsorted = await move(fresh.id, { status: 'unassigned' }).expect(409);
    expect((unsorted.body as Body<{ missing: string[] }>).data.missing).toEqual(
      ['category', 'description'],
    );
    const issue = await createIssue();
    await patch(issue.id, { categoryId: f.paint, description: 'x' }).expect(
      200,
    );
    const noWorker = await move(issue.id, { status: 'sent' }).expect(409);
    expect((noWorker.body as Body<null>).error).toBe(
      DomainErrorCode.ISSUE_REQUIREMENTS,
    );
    const assigned = await issueIn('assigned');
    const noDate = await move(assigned.id, { status: 'estimated' }).expect(409);
    expect((noDate.body as Body<{ missing: string[] }>).data.missing).toEqual([
      'estimatedDate',
    ]);
  });

  it('assignedAt/sentAt/solvedAt set the first time only', async () => {
    const issue = await issueIn('assigned');
    t.clock.advance(60_000);
    await move(issue.id, { status: 'sent' }).expect(200);
    t.clock.advance(60_000);
    await move(issue.id, { status: 'solved' }).expect(200);
    const first = await getIssue(issue.id);
    expect(first.assignedAt).not.toBeNull();
    expect(first.sentAt).not.toBeNull();
    expect(first.solvedAt).not.toBeNull();

    t.clock.advance(60_000);
    await move(issue.id, { status: 'assigned' }).expect(200); // reopen
    t.clock.advance(60_000);
    await move(issue.id, { status: 'sent' }).expect(200);
    t.clock.advance(60_000);
    await move(issue.id, { status: 'solved' }).expect(200);
    const again = await getIssue(issue.id);
    expect(again.assignedAt).toBe(first.assignedAt);
    expect(again.sentAt).toBe(first.sentAt);
    expect(again.solvedAt).toBe(first.solvedAt);
  });

  it('reopen solved → assigned with worker, → unassigned without', async () => {
    const withWorker = await issueIn('solved');
    const a = await move(withWorker.id, { status: 'assigned' }).expect(200);
    expect((a.body as Body<Issue>).data.status).toBe('assigned');

    const cancelled = await createIssue();
    await patch(cancelled.id, { categoryId: f.paint, description: 'x' });
    await move(cancelled.id, { status: 'cancelled' }).expect(200);
    const u = await move(cancelled.id, { status: 'assigned' }).expect(200);
    expect((u.body as Body<Issue>).data.status).toBe('unassigned');
  });

  it('status note stored on the history row', async () => {
    const issue = await issueIn('assigned');
    await move(issue.id, {
      status: 'cancelled',
      note: '  Duplicate of #3  ',
    }).expect(200);
    const last = (await getIssue(issue.id)).history.at(-1);
    expect(last).toMatchObject({
      from: 'assigned',
      to: 'cancelled',
      note: 'Duplicate of #3',
    });
  });

  it('estimated date sent with the move is stored', async () => {
    const issue = await issueIn('sent');
    const res = await move(issue.id, {
      status: 'estimated',
      estimatedDate: '2099-05-06',
    }).expect(200);
    expect((res.body as Body<Issue>).data).toMatchObject({
      status: 'estimated',
      estimatedDate: '2099-05-06',
    });
  });
});

// =================================================================== bulk

describe('POST /issues/bulk', () => {
  it('bulk: one failing id → nothing changes, 409 lists it', async () => {
    const ok1 = await issueIn('assigned');
    const ok2 = await issueIn('assigned');
    const bad = await createIssue(); // new, no worker: can't be sent
    const res = await post(`${ISSUES}/bulk`)
      .send({ ids: [ok1.id, bad.id, ok2.id], status: 'sent' })
      .expect(409);
    expect((res.body as Body<{ ids: string[] }>).data.ids).toEqual([bad.id]);
    for (const id of [ok1.id, ok2.id]) {
      expect((await getIssue(id)).status).toBe('assigned');
    }
    expect((await getIssue(bad.id)).status).toBe('new');
  });

  it('bulk >200 ids → 400', async () => {
    const ids = Array.from({ length: 201 }, () => randomUUID());
    await post(`${ISSUES}/bulk`).send({ ids, status: 'sent' }).expect(400);
  });

  it('bulk with an unknown id → 404 listing it, nothing changes', async () => {
    const ok = await issueIn('assigned');
    const ghost = randomUUID();
    const res = await post(`${ISSUES}/bulk`)
      .send({ ids: [ok.id, ghost], status: 'sent' })
      .expect(404);
    expect((res.body as Body<{ ids: string[] }>).data.ids).toEqual([ghost]);
    expect((await getIssue(ok.id)).status).toBe('assigned');
  });

  it('bulk category on new issues without description → stay new', async () => {
    const a = await createIssue();
    const b = await createIssue({ description: 'Has text' });
    const res = await post(`${ISSUES}/bulk`)
      .send({ ids: [a.id, b.id], categoryId: f.elec })
      .expect(200);
    const out = (res.body as Body<{ updated: number; issues: Issue[] }>).data;
    expect(out.updated).toBe(2);
    const byId = new Map(out.issues.map((i) => [i.id, i]));
    expect(byId.get(a.id)).toMatchObject({
      status: 'new',
      category: { id: f.elec },
    });
    // The one that already had a description is now sorted.
    expect(byId.get(b.id)?.status).toBe('unassigned');
  });

  it('bulk status / reopen write exactly one history row per issue; merge writes none', async () => {
    const a = await issueIn('assigned');
    const b = await issueIn('sent');
    const counts = [await historyCount(a.id), await historyCount(b.id)];
    await post(`${ISSUES}/bulk`)
      .send({ ids: [a.id, b.id], status: 'solved', note: 'Walkthrough ok' })
      .expect(200);
    expect(await historyCount(a.id)).toBe(counts[0] + 1);
    expect(await historyCount(b.id)).toBe(counts[1] + 1);
    expect((await getIssue(a.id)).history.at(-1)?.note).toBe('Walkthrough ok');

    await post(`${ISSUES}/bulk`)
      .send({ ids: [a.id, b.id], status: 'assigned' }) // reopen
      .expect(200);
    expect(await historyCount(a.id)).toBe(counts[0] + 2);
    expect(await historyCount(b.id)).toBe(counts[1] + 2);
    expect((await getIssue(b.id)).status).toBe('assigned');

    const target = await createIssue();
    const source = await createIssue();
    const targetHistory = await historyCount(target.id);
    await post(`${ISSUES}/${target.id}/merge`)
      .send({ sourceId: source.id })
      .expect(200);
    expect(await historyCount(target.id)).toBe(targetHistory);
  });

  it('bulk worker on unassigned issues → assigned', async () => {
    const a = await createIssue();
    await patch(a.id, { categoryId: f.paint, description: 'x' }).expect(200);
    const res = await post(`${ISSUES}/bulk`)
      .send({ ids: [a.id], workerId: f.wBoth })
      .expect(200);
    expect(
      (res.body as Body<{ issues: Issue[] }>).data.issues[0],
    ).toMatchObject({ status: 'assigned', worker: { id: f.wBoth } });
  });
});

// ========================================================= merge / delete

describe('merge and delete', () => {
  it('merge: both must be new; photos moved; source deleted; >10 → 409', async () => {
    const target = await createIssue();
    const source = await createIssue();
    await addPhoto(source.id, 'before').expect(201);
    const res = await post(`${ISSUES}/${target.id}/merge`)
      .send({ sourceId: source.id })
      .expect(200);
    const merged = (res.body as Body<Issue>).data;
    expect(merged.photos.filter((p) => p.kind === 'before')).toHaveLength(3);
    expect(merged.photos[0].id).toBe(target.photos[0].id); // cover kept
    expect(await t.db.issue.count({ where: { id: source.id } })).toBe(0);

    const sorted = await issueIn('assigned');
    const fresh = await createIssue();
    const notNew = await post(`${ISSUES}/${fresh.id}/merge`)
      .send({ sourceId: sorted.id })
      .expect(409);
    expect((notNew.body as Body<null>).error).toBe(DomainErrorCode.NOT_NEW);

    const full = await createIssue();
    for (let i = 0; i < 9; i++) await addPhoto(full.id, 'before').expect(201);
    const extra = await createIssue();
    const over = await post(`${ISSUES}/${full.id}/merge`)
      .send({ sourceId: extra.id })
      .expect(409);
    expect((over.body as Body<null>).error).toBe(DomainErrorCode.PHOTO_LIMIT);
    expect(await t.db.issue.count({ where: { id: extra.id } })).toBe(1);
  });

  it('delete a new issue removes it with its photos', async () => {
    const issue = await createIssue();
    const res = await request(t.http)
      .delete(`${ISSUES}/${issue.id}`)
      .set(auth())
      .expect(200);
    expect((res.body as Body<{ id: string }>).data).toEqual({ id: issue.id });
    expect(await t.db.photo.count({ where: { issueId: issue.id } })).toBe(0);
    await request(t.http).get(`${ISSUES}/${issue.id}`).set(auth()).expect(404);
  });

  it('no endpoint edits or deletes a status change', async () => {
    const issue = await issueIn('sent');
    const history = (await getIssue(issue.id)).history;
    const change = history[history.length - 1];
    const base = `${ISSUES}/${issue.id}/history`;
    await request(t.http)
      .delete(`${base}/${change.id}`)
      .set(auth())
      .expect(404);
    await request(t.http)
      .patch(`${base}/${change.id}`)
      .set(auth())
      .send({ note: 'x' })
      .expect(404);
    await request(t.http).put(base).set(auth()).send([]).expect(404);
    const after = (await getIssue(issue.id)).history;
    expect(after).toEqual(history);
  });

  it('every route needs a token', async () => {
    await request(t.http).get(ISSUES).expect(401);
    await request(t.http).post(`${ISSUES}/bulk`).send({}).expect(401);
  });
});

// =================================================================== list

describe('GET /issues', () => {
  /** A site of its own so the counts below aren't disturbed by other tests. */
  let s: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    s = await makeSite('Filters site');
    // a: new, captured Cairo 2026-03-10 23:30 (21:30Z), priority low
    ids.a = (
      await createIssue({
        siteId: s,
        capturedAt: '2026-03-10T21:30:00.000Z',
        description: 'Leaking pipe in kitchen',
      })
    ).id;
    await patch(ids.a, { priority: 'low' }).expect(200);
    // b: assigned (paint, wPaint), Cairo 2026-03-11 00:30 (22:30Z), urgent, location Roof
    ids.b = (
      await assignedIssue({
        siteId: s,
        capturedAt: '2026-03-10T22:30:00.000Z',
        location: 'Roof',
      })
    ).id;
    await patch(ids.b, { priority: 'urgent' }).expect(200);
    // c: estimated, overdue (date in the past), elec, wElec, high
    ids.c = (
      await createIssue({ siteId: s, capturedAt: '2026-03-12T10:00:00.000Z' })
    ).id;
    await patch(ids.c, {
      categoryId: f.elec,
      description: 'Socket loose',
      workerId: f.wElec,
      priority: 'high',
    }).expect(200);
    await move(ids.c, {
      status: 'estimated',
      estimatedDate: '2026-01-01',
    }).expect(200);
    // d: estimated in the future, captured last
    ids.d = (
      await createIssue({ siteId: s, capturedAt: '2026-03-13T10:00:00.000Z' })
    ).id;
    await patch(ids.d, {
      categoryId: f.paint,
      description: 'Stain',
      workerId: f.wPaint,
    }).expect(200);
    await move(ids.d, {
      status: 'estimated',
      estimatedDate: '2099-01-01',
    }).expect(200);
    // e: solved, solvedAt pinned to Cairo 2026-04-05 01:00 (2026-04-04T23:00Z)
    ids.e = (
      await createIssue({ siteId: s, capturedAt: '2026-03-01T10:00:00.000Z' })
    ).id;
    await patch(ids.e, {
      categoryId: f.paint,
      description: 'Done one',
      workerId: f.wPaint,
      estimatedDate: '2026-01-01', // past, but solved → not overdue
    }).expect(200);
    await move(ids.e, { status: 'solved' }).expect(200);
    await t.db.issue.update({
      where: { id: ids.e },
      data: { solvedAt: new Date('2026-04-04T23:00:00.000Z') },
    });
  });

  const idsOf = (rows: Issue[]) => rows.map((r) => r.id);
  const inSite = (q: Record<string, string | number>) =>
    list({ siteId: s, ...q }).then((b) => b.data);
  const key = (id: string) =>
    Object.entries(ids).find(([, v]) => v === id)?.[0];

  it('list filters: each filter alone + combined; status list; overdue; q matches number/description/location', async () => {
    // siteId alone
    expect(idsOf(await inSite({})).sort()).toEqual(Object.values(ids).sort());
    // categoryId alone (across all sites, every row matches)
    const byCat = (await list({ categoryId: f.elec, limit: 100 })).data;
    expect(byCat.every((i) => i.category?.id === f.elec)).toBe(true);
    expect(idsOf(byCat)).toContain(ids.c);
    // workerId alone
    const byWorker = (await list({ workerId: f.wElec, limit: 100 })).data;
    expect(byWorker.every((i) => i.worker?.id === f.wElec)).toBe(true);
    expect(idsOf(byWorker)).toContain(ids.c);
    // status list
    expect(
      (await inSite({ status: 'new,assigned' })).map((i) => key(i.id)).sort(),
    ).toEqual(['a', 'b']);
    // priority list
    expect(
      (await inSite({ priority: 'urgent,high' })).map((i) => key(i.id)).sort(),
    ).toEqual(['b', 'c']);
    // overdue
    const overdue = await inSite({ overdue: 'true' });
    expect(overdue.map((i) => key(i.id))).toEqual(['c']);
    expect(overdue[0].overdue).toBe(true);
    expect(
      (await inSite({ overdue: 'false' })).map((i) => key(i.id)).sort(),
    ).toEqual(['a', 'b', 'd', 'e']);
    // q: number, description, location (case-insensitive)
    const number = (await getIssue(ids.b)).number;
    expect((await inSite({ q: `#${number}` })).map((i) => key(i.id))).toContain(
      'b',
    );
    expect((await inSite({ q: 'leaking' })).map((i) => key(i.id))).toEqual([
      'a',
    ]);
    expect((await inSite({ q: 'roof' })).map((i) => key(i.id))).toEqual(['b']);
    // combined
    expect(
      (
        await inSite({
          status: 'estimated',
          categoryId: f.paint,
          overdue: 'false',
        })
      ).map((i) => key(i.id)),
    ).toEqual(['d']);
  });

  it('sorts newest/oldest/priority/estimate order correctly; capturedFrom/To and solvedFrom/To bounds inclusive', async () => {
    expect((await inSite({ sort: 'newest' })).map((i) => key(i.id))).toEqual([
      'd',
      'c',
      'b',
      'a',
      'e',
    ]);
    expect((await inSite({ sort: 'oldest' })).map((i) => key(i.id))).toEqual([
      'e',
      'a',
      'b',
      'c',
      'd',
    ]);
    // urgent, high, then normal (newest first), then low
    expect((await inSite({ sort: 'priority' })).map((i) => key(i.id))).toEqual([
      'b',
      'c',
      'd',
      'e',
      'a',
    ]);
    // earliest estimate first (c and e share 2026-01-01: newest first), no date last
    expect((await inSite({ sort: 'estimate' })).map((i) => key(i.id))).toEqual([
      'c',
      'e',
      'd',
      'b',
      'a',
    ]);

    // Captured days are Cairo days: a is 2026-03-10 23:30, b is 2026-03-11 00:30.
    const day = async (from?: string, to?: string) =>
      (
        await inSite({
          ...(from && { capturedFrom: from }),
          ...(to && { capturedTo: to }),
        })
      )
        .map((i) => key(i.id))
        .sort();
    expect(await day('2026-03-10', '2026-03-10')).toEqual(['a']);
    expect(await day('2026-03-11', '2026-03-11')).toEqual(['b']);
    expect(await day('2026-03-10', '2026-03-12')).toEqual(['a', 'b', 'c']);
    expect(await day(undefined, '2026-03-01')).toEqual(['e']);

    // e was solved Cairo 2026-04-05 01:00.
    const solved = async (from: string, to: string) =>
      (await inSite({ solvedFrom: from, solvedTo: to })).map((i) => key(i.id));
    expect(await solved('2026-04-05', '2026-04-05')).toEqual(['e']);
    expect(await solved('2026-04-04', '2026-04-04')).toEqual([]);
  });

  it("archived site's issues returned when filtered by that site", async () => {
    const site = await makeSite('Soon archived');
    const issue = await createIssue({ siteId: site });
    await t.db.site.update({ where: { id: site }, data: { archived: true } });
    expect(idsOf(await list({ siteId: site }).then((b) => b.data))).toEqual([
      issue.id,
    ]);
  });

  it('limit 101 → 400; page beyond → empty', async () => {
    const res = await request(t.http)
      .get(ISSUES)
      .query({ limit: 101 })
      .set(auth())
      .expect(400);
    expect((res.body as Body<null>).error).toBe(ErrorCode.VALIDATION_FAILED);
    const page = await list({ siteId: s, page: 50, limit: 10 });
    expect(page.data).toEqual([]);
    expect(page.meta).toMatchObject({ total: 5, page: 50, hasNextPage: false });
  });

  it('pagination meta and bad filter values', async () => {
    const page = await list({ siteId: s, page: 1, limit: 2 });
    expect(page.data).toHaveLength(2);
    expect(page.meta).toMatchObject({ total: 5, hasNextPage: true });
    await request(t.http)
      .get(ISSUES)
      .query({ status: 'new,bogus' })
      .set(auth())
      .expect(400);
    await request(t.http)
      .get(ISSUES)
      .query({ capturedFrom: '2026-13-01' })
      .set(auth())
      .expect(400);
  });

  it('GET one returns the issue with its history in order', async () => {
    const detail = await getIssue(ids.c);
    expect(detail.history.map((h) => [h.from, h.to])).toEqual([
      [null, 'new'],
      ['new', 'assigned'],
      ['assigned', 'estimated'],
    ]);
    await request(t.http)
      .get(`${ISSUES}/${randomUUID()}`)
      .set(auth())
      .expect(404);
  });
});
