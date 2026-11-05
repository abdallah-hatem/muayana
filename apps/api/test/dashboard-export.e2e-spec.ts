import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  CSV_BOM,
  ErrorCode,
  ISSUE_EXPORT_COLUMNS,
  type Dashboard,
  type IssueStatus,
} from '@muayana/shared';
import { EXPORT_BATCH } from '../src/domains/issues/issues-export.service';
import {
  cairoDate,
  makeCategory,
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

/*
 * Dashboard + issues / status-history CSV (plan T7). One test per planned edge case, named
 * after it.
 */

const API = '/api/v1';
const DASHBOARD = `${API}/dashboard`;
const EXPORT = `${API}/issues/export.csv`;
const HISTORY = `${API}/issues/history.csv`;

/** RFC 4180 rows (quoted cells may hold commas, quotes and newlines). BOM stripped. */
function parseCsv(text: string): string[][] {
  const body = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  return rows;
}

describe('Dashboard + CSV exports (e2e)', () => {
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
  const dashboard = async (query = ''): Promise<Dashboard> =>
    (
      (await get(`${DASHBOARD}${query}`).expect(200)).body as {
        data: Dashboard;
      }
    ).data;
  const csv = (path: string) =>
    get(path)
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => done(null, text));
      });
  const csvText = async (path: string): Promise<string> =>
    (await csv(path).expect(200)).body as string;
  const csvRows = async (path: string) => parseCsv(await csvText(path));

  /** An issue straight in the database, numbered from its site's counter. */
  async function issue(data: {
    siteId: string;
    status?: IssueStatus;
    categoryId?: string | null;
    workerId?: string | null;
    estimatedDate?: string | null;
    description?: string | null;
    capturedAt?: Date;
    assignedAt?: Date | null;
  }) {
    const site = await t.db.site.update({
      where: { id: data.siteId },
      data: { nextNumber: { increment: 1 } },
    });
    const status = data.status ?? 'new';
    return t.db.issue.create({
      data: {
        id: randomUUID(),
        siteId: data.siteId,
        number: site.nextNumber - 1,
        status,
        description:
          data.description !== undefined
            ? data.description
            : status === 'new'
              ? null
              : 'A defect',
        categoryId: data.categoryId ?? null,
        workerId: data.workerId ?? null,
        estimatedDate: data.estimatedDate
          ? new Date(`${data.estimatedDate}T00:00:00.000Z`)
          : null,
        capturedAt: data.capturedAt ?? t.clock.now(),
        assignedAt: data.assignedAt ?? null,
      },
    });
  }

  async function photo(issueId: string, kind: 'before' | 'after', n: number) {
    await t.db.photo.create({
      data: {
        id: randomUUID(),
        issueId,
        kind,
        storageKey: `issues/${issueId}/${kind}${n}.jpg`,
        url: `http://localhost:3171/uploads/issues/${issueId}/${kind}${n}.jpg`,
        width: 10,
        height: 10,
        sortOrder: n,
      },
    });
  }

  it('needs a token (dashboard and both CSVs)', async () => {
    await request(t.http).get(DASHBOARD).expect(401);
    await request(t.http).get(EXPORT).expect(401);
    await request(t.http).get(HISTORY).expect(401);
  });

  // ------------------------------------------------------------- dashboard

  /** Two active sites + one archived, two categories, two workers, issues across them. */
  async function seedDashboard() {
    const tower = await makeSite(t.db, 'Tower');
    const villa = await makeSite(t.db, 'Villa');
    const old = await makeSite(t.db, 'Old', true);
    const paint = await makeCategory(t.db, 'دهان', { sortOrder: 1 });
    const elec = await makeCategory(t.db, 'كهرباء', { sortOrder: 2 });
    const ali = await makeWorker(t.db, [paint.id, elec.id], { name: 'Ali' });
    const omar = await makeWorker(t.db, [elec.id], { name: 'Omar' });
    const past = cairoDate(t.clock.now(), -2);
    const future = cairoDate(t.clock.now(), 3);

    await issue({ siteId: tower.id });
    await issue({ siteId: tower.id });
    await issue({
      siteId: tower.id,
      status: 'unassigned',
      categoryId: paint.id,
    });
    await issue({
      siteId: tower.id,
      status: 'assigned',
      categoryId: paint.id,
      workerId: ali.id,
    });
    await issue({
      siteId: tower.id,
      status: 'estimated',
      categoryId: paint.id,
      workerId: ali.id,
      estimatedDate: past,
    });
    await issue({
      siteId: tower.id,
      status: 'solved',
      categoryId: paint.id,
      workerId: ali.id,
      estimatedDate: past,
    });
    await issue({ siteId: villa.id });
    await issue({
      siteId: villa.id,
      status: 'estimated',
      categoryId: elec.id,
      workerId: omar.id,
      estimatedDate: future,
    });
    await issue({
      siteId: villa.id,
      status: 'in_progress',
      categoryId: elec.id,
      workerId: omar.id,
      estimatedDate: past,
    });
    await issue({ siteId: villa.id, status: 'cancelled', categoryId: elec.id });
    // Archived site: none of these may show anywhere on the dashboard.
    await issue({ siteId: old.id });
    await issue({
      siteId: old.id,
      status: 'sent',
      categoryId: paint.id,
      workerId: ali.id,
      estimatedDate: past,
    });
    await issue({
      siteId: old.id,
      status: 'in_progress',
      categoryId: elec.id,
      workerId: omar.id,
    });
    return { tower, villa, old, paint, elec, ali, omar };
  }

  it('Dashboard counts per status/category/worker/site match seeded data; archived sites excluded (§5.9)', async () => {
    const s = await seedDashboard();
    const d = await dashboard();

    expect(d.byStatus).toEqual({
      new: 3,
      unassigned: 1,
      assigned: 1,
      sent: 0,
      estimated: 2,
      in_progress: 1,
      solved: 1,
      cancelled: 1,
    });
    expect(d.overdue).toBe(2);
    expect(d.byCategory).toEqual([
      {
        category: {
          id: s.paint.id,
          nameAr: 'دهان',
          nameEn: null,
          color: '#336699',
        },
        open: 3,
        overdue: 1,
      },
      {
        category: {
          id: s.elec.id,
          nameAr: 'كهرباء',
          nameEn: null,
          color: '#336699',
        },
        open: 2,
        overdue: 1,
      },
    ]);
    expect(d.byWorker).toEqual([
      {
        worker: { id: s.ali.id, name: 'Ali', phone: s.ali.phone },
        open: 2,
        overdue: 1,
      },
      {
        worker: { id: s.omar.id, name: 'Omar', phone: s.omar.phone },
        open: 2,
        overdue: 1,
      },
    ]);
    expect(d.bySite).toEqual([
      { site: { id: s.tower.id, name: 'Tower' }, open: 3, new: 2, overdue: 1 },
      { site: { id: s.villa.id, name: 'Villa' }, open: 2, new: 1, overdue: 1 },
    ]);
  });

  it('Dashboard siteId filter (§5.9)', async () => {
    const s = await seedDashboard();
    const d = await dashboard(`?siteId=${s.villa.id}`);
    expect(d.byStatus).toMatchObject({
      new: 1,
      estimated: 1,
      in_progress: 1,
      cancelled: 1,
      unassigned: 0,
    });
    expect(d.inbox).toBe(1);
    expect(d.overdue).toBe(1);
    expect(d.byCategory.map((r) => r.category.id)).toEqual([s.elec.id]);
    expect(d.byWorker).toEqual([
      {
        worker: { id: s.omar.id, name: 'Omar', phone: s.omar.phone },
        open: 2,
        overdue: 1,
      },
    ]);
    expect(d.bySite).toEqual([
      { site: { id: s.villa.id, name: 'Villa' }, open: 2, new: 1, overdue: 1 },
    ]);

    // The archived site's dashboard is empty: it is left out of the dashboard entirely.
    const archived = await dashboard(`?siteId=${s.old.id}`);
    expect(archived.inbox).toBe(0);
    expect(archived.overdue).toBe(0);
    expect(archived.bySite).toEqual([]);
    expect(archived.byWorker).toEqual([]);

    await get(`${DASHBOARD}?siteId=nope`).expect(400);
  });

  it('Inbox count equals the number of `new` issues (§5.9)', async () => {
    const empty = await dashboard();
    expect(empty.inbox).toBe(0);
    expect(empty.byStatus.new).toBe(0);

    await seedDashboard();
    const d = await dashboard();
    const activeNew = await t.db.issue.count({
      where: { status: 'new', site: { archived: false } },
    });
    expect(d.inbox).toBe(activeNew);
    expect(d.inbox).toBe(d.byStatus.new);
  });

  // ------------------------------------------------------------- issues CSV

  it('Issues CSV exports all matching rows, not one page (§7)', async () => {
    const site = await makeSite(t.db, 'Big');
    const other = await makeSite(t.db, 'Other');
    const total = EXPORT_BATCH * 2 + 7; // three batches, the last one short
    await t.db.issue.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        id: randomUUID(),
        siteId: site.id,
        number: i + 1,
        capturedAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
      })),
    });
    await issue({ siteId: other.id });

    const rows = await csvRows(
      `${EXPORT}?siteId=${site.id}&columns=number&lang=en`,
    );
    expect(rows[0]).toEqual(['Number']);
    const numbers = rows.slice(1).map((r) => Number(r[0]));
    expect(numbers).toHaveLength(total);
    expect(new Set(numbers).size).toBe(total);
    // The list's default order (newest first) holds across batches.
    expect(numbers[0]).toBe(total);
    expect(numbers[numbers.length - 1]).toBe(1);
  });

  it('Only requested columns, in order; unknown column → 400 (§7)', async () => {
    const site = await makeSite(t.db, 'Tower');
    await issue({ siteId: site.id, description: 'Crack' });

    const rows = await csvRows(
      `${EXPORT}?columns=description,number,site&lang=en`,
    );
    expect(rows).toEqual([
      ['Description', 'Number', 'Site'],
      ['Crack', '1', 'Tower'],
    ]);

    // Default: every §7 column, in §7 order.
    const all = await csvRows(`${EXPORT}?lang=en`);
    expect(all[0]).toHaveLength(ISSUE_EXPORT_COLUMNS.length);
    expect(all[0][0]).toBe('Number');
    expect(all[0][ISSUE_EXPORT_COLUMNS.length - 1]).toBe('Last note');

    const bad = await get(`${EXPORT}?columns=number,secret`).expect(400);
    expect(bad.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    await get(`${EXPORT}?columns=`).expect(400);
    await get(`${EXPORT}?lang=fr`).expect(400);
  });

  it('BOM present; Arabic headers with lang=ar, English with en (§7)', async () => {
    const site = await makeSite(t.db, 'Tower');
    await issue({ siteId: site.id });

    const res = await csv(`${EXPORT}?columns=number,status`).expect(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="issues.csv"',
    );
    const ar = res.body as string;
    expect(ar.startsWith(CSV_BOM)).toBe(true);
    expect(parseCsv(ar)).toEqual([
      ['الرقم', 'الحالة'],
      ['1', 'جديد'],
    ]);

    const en = await csvText(`${EXPORT}?columns=number,status&lang=en`);
    expect(en.startsWith(CSV_BOM)).toBe(true);
    expect(parseCsv(en)).toEqual([
      ['Number', 'Status'],
      ['1', 'New'],
    ]);

    const history = await csv(`${HISTORY}?lang=en`).expect(200);
    expect((history.body as string).startsWith(CSV_BOM)).toBe(true);
    expect(parseCsv(history.body as string)[0]).toEqual([
      'Site',
      'Number',
      'From',
      'To',
      'Date',
      'Note',
    ]);
    expect(parseCsv(await csvText(HISTORY))[0][0]).toBe('الموقع');
  });

  it('Dates in Cairo time `YYYY-MM-DD HH:mm` (§7)', async () => {
    const site = await makeSite(t.db, 'Tower');
    const cat = await makeCategory(t.db);
    const w = await makeWorker(t.db, [cat.id]);
    const i = await issue({
      siteId: site.id,
      status: 'assigned',
      categoryId: cat.id,
      workerId: w.id,
      capturedAt: new Date('2026-11-05T22:05:00Z'), // winter: UTC+2
      assignedAt: new Date('2026-07-01T09:00:00Z'), // summer: UTC+3
    });
    await t.db.statusChange.create({
      data: {
        issueId: i.id,
        from: 'unassigned',
        to: 'assigned',
        createdAt: new Date('2026-11-05T22:30:00Z'),
      },
    });

    const rows = await csvRows(
      `${EXPORT}?columns=capturedAt,assignedAt,sentAt&lang=en`,
    );
    expect(rows[1]).toEqual(['2026-11-06 00:05', '2026-07-01 12:00', '']);
    const history = await csvRows(`${HISTORY}?lang=en`);
    expect(history[1][4]).toBe('2026-11-06 00:30');
  });

  it('Description "=SUM(A1)" exported as "\'=SUM(A1)" (§7)', async () => {
    const site = await makeSite(t.db, '+Tower');
    await issue({
      siteId: site.id,
      status: 'cancelled',
      description: '=SUM(A1)',
      categoryId: (await makeCategory(t.db)).id,
    });

    const text = await csvText(
      `${EXPORT}?columns=description,site,number&lang=en`,
    );
    expect(text).toContain("'=SUM(A1),'+Tower,1\r\n");
  });

  it('History CSV contains every status change of the filtered issues (§7)', async () => {
    const site = await makeSite(t.db, 'Tower');
    const cat = await makeCategory(t.db);
    const w = await makeWorker(t.db, [cat.id]);
    const a = await issue({
      siteId: site.id,
      status: 'solved',
      categoryId: cat.id,
      workerId: w.id,
    });
    const b = await issue({
      siteId: site.id,
      status: 'unassigned',
      categoryId: cat.id,
    });
    const at = (m: number) => new Date(Date.UTC(2026, 10, 1, 8, m));
    await t.db.statusChange.createMany({
      data: [
        { issueId: a.id, from: null, to: 'new', createdAt: at(0) },
        { issueId: a.id, from: 'new', to: 'assigned', createdAt: at(1) },
        {
          issueId: a.id,
          from: 'assigned',
          to: 'solved',
          note: 'fixed, "done"',
          createdAt: at(2),
        },
        { issueId: b.id, from: null, to: 'new', createdAt: at(3) },
        { issueId: b.id, from: 'new', to: 'unassigned', createdAt: at(4) },
      ],
    });

    const all = await csvRows(`${HISTORY}?lang=en`);
    expect(all.slice(1)).toEqual([
      ['Tower', '1', '', 'New', '2026-11-01 10:00', ''],
      ['Tower', '1', 'New', 'Assigned', '2026-11-01 10:01', ''],
      ['Tower', '1', 'Assigned', 'Solved', '2026-11-01 10:02', 'fixed, "done"'],
      ['Tower', '2', '', 'New', '2026-11-01 10:03', ''],
      ['Tower', '2', 'New', 'Unassigned', '2026-11-01 10:04', ''],
    ]);

    // Filtered to the solved issue: only its three changes.
    const solved = await csvRows(`${HISTORY}?status=solved&lang=en`);
    expect(solved.slice(1).map((r) => [r[1], r[3]])).toEqual([
      ['1', 'New'],
      ['1', 'Assigned'],
      ['1', 'Solved'],
    ]);
    await get(`${HISTORY}?status=bogus`).expect(400);
  });

  it('Column values: days open, overdue yes/no, photo links, after-photo links, last note (§7)', async () => {
    const site = await makeSite(t.db, 'Tower');
    const cat = await makeCategory(t.db);
    const w = await makeWorker(t.db, [cat.id]);
    const now = t.clock.now();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    // Open and overdue, captured 4 days ago, two before-photos and an after-photo.
    const late = await issue({
      siteId: site.id,
      status: 'estimated',
      categoryId: cat.id,
      workerId: w.id,
      estimatedDate: cairoDate(now, -1),
      capturedAt: daysAgo(4),
    });
    await photo(late.id, 'before', 0);
    await photo(late.id, 'before', 1);
    await photo(late.id, 'after', 0);
    await t.db.statusChange.createMany({
      data: [
        {
          issueId: late.id,
          from: 'sent',
          to: 'estimated',
          note: 'Friday',
          createdAt: daysAgo(3),
        },
        {
          issueId: late.id,
          from: 'assigned',
          to: 'sent',
          note: null,
          createdAt: daysAgo(2),
        },
      ],
    });
    // Solved two days after capture, with a past estimate: not overdue, days open stop.
    const done = await issue({
      siteId: site.id,
      status: 'solved',
      categoryId: cat.id,
      workerId: w.id,
      estimatedDate: cairoDate(now, -5),
      capturedAt: daysAgo(10),
    });
    await t.db.statusChange.create({
      data: {
        issueId: done.id,
        from: 'in_progress',
        to: 'solved',
        createdAt: daysAgo(8),
      },
    });

    const rows = await csvRows(
      `${EXPORT}?columns=number,overdue,daysOpen,photoLinks,afterPhotoLinks,lastNote&lang=en&sort=oldest`,
    );
    const base = `http://localhost:3171/uploads/issues`;
    expect(rows.slice(1)).toEqual([
      ['2', 'No', '2', '', '', ''],
      [
        '1',
        'Yes',
        '4',
        `${base}/${late.id}/before0.jpg\n${base}/${late.id}/before1.jpg`,
        `${base}/${late.id}/after0.jpg`,
        'Friday',
      ],
    ]);
    const ar = await csvRows(`${EXPORT}?columns=overdue&sort=oldest`);
    expect(ar.slice(1)).toEqual([['لا'], ['نعم']]);
  });

  it("Archived site's issues exported when the filter includes that site (§3)", async () => {
    const live = await makeSite(t.db, 'Live');
    const old = await makeSite(t.db, 'Old', true);
    const cat = await makeCategory(t.db);
    await issue({ siteId: live.id });
    const archivedIssue = await issue({
      siteId: old.id,
      status: 'unassigned',
      categoryId: cat.id,
    });
    await t.db.statusChange.create({
      data: { issueId: archivedIssue.id, from: 'new', to: 'unassigned' },
    });

    const rows = await csvRows(
      `${EXPORT}?siteId=${old.id}&columns=site,number&lang=en`,
    );
    expect(rows.slice(1)).toEqual([['Old', '1']]);
    const history = await csvRows(`${HISTORY}?siteId=${old.id}&lang=en`);
    expect(history.slice(1).map((r) => [r[0], r[3]])).toEqual([
      ['Old', 'Unassigned'],
    ]);
    // And they stay in the unfiltered export too (only the dashboard leaves them out).
    const all = await csvRows(`${EXPORT}?columns=site&lang=en`);
    expect(
      all
        .slice(1)
        .map((r) => r[0])
        .sort(),
    ).toEqual(['Live', 'Old']);
  });
});
