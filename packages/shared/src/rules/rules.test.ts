import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  type IssueState,
  type WhatsAppIssue,
  applyPatch,
  buildBatchMessage,
  buildIssueMessage,
  canMove,
  escapeCsvCell,
  formatCairoDateTime,
  isOverdue,
  normalizeEgyptPhone,
  priorityLabelKey,
  priorityRank,
  reopenTarget,
  statusLabelKey,
  toCsv,
  todayInCairo,
  waMeUrl,
} from '../index';

const PAINT = 'cat-paint';
const ELEC = 'cat-elec';
const ALI = 'worker-ali';
const OMAR = 'worker-omar';

const sorted = (over: Partial<IssueState> = {}): IssueState => ({
  status: 'unassigned',
  categoryId: PAINT,
  description: 'Cracked wall',
  workerId: null,
  estimatedDate: null,
  ...over,
});
const withWorker = (over: Partial<IssueState> = {}): IssueState =>
  sorted({ status: 'assigned', workerId: ALI, ...over });
const fresh = (over: Partial<IssueState> = {}): IssueState =>
  sorted({ status: 'new', categoryId: null, description: null, ...over });

const painter = { worker: { categoryIds: [PAINT], active: true } };
const noWorker = { worker: null };

describe('canMove (§4, §6)', () => {
  it('Move to unassigned without description → refused (§6.1)', () => {
    expect(canMove(fresh({ categoryId: PAINT }), 'unassigned')).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['description'],
    });
  });

  it('Move to assigned/sent/estimated/in_progress/solved without worker → refused (§6.2)', () => {
    for (const to of [
      'assigned',
      'sent',
      'estimated',
      'in_progress',
      'solved',
    ] as const) {
      const result = canMove(sorted({ estimatedDate: '2026-11-10' }), to);
      expect(result).toEqual({
        ok: false,
        code: 'ISSUE_REQUIREMENTS',
        missing: ['worker'],
      });
    }
  });

  it('Move to estimated without date → refused (§6.4)', () => {
    expect(canMove(withWorker({ status: 'sent' }), 'estimated')).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['estimatedDate'],
    });
  });

  it('Any status → new → refused BACK_TO_NEW (§6.6)', () => {
    for (const status of [
      'unassigned',
      'assigned',
      'sent',
      'estimated',
      'in_progress',
      'solved',
      'cancelled',
    ] as const) {
      expect(
        canMove(withWorker({ status, estimatedDate: '2026-11-10' }), 'new'),
      ).toEqual({
        ok: false,
        code: 'BACK_TO_NEW',
        missing: [],
      });
    }
  });

  it('Skip forward assigned → in_progress with worker → allowed (§4)', () => {
    expect(canMove(withWorker(), 'in_progress')).toEqual({ ok: true });
  });

  it('Back solved → sent → allowed (§4)', () => {
    expect(canMove(withWorker({ status: 'solved' }), 'sent')).toEqual({
      ok: true,
    });
  });

  it('Move to unassigned while worker set → refused (§4)', () => {
    expect(canMove(withWorker({ status: 'sent' }), 'unassigned')).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['noWorker'],
    });
  });

  it('Cancelled requires category + description (§4)', () => {
    expect(canMove(fresh(), 'cancelled')).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['category', 'description'],
    });
    expect(canMove(sorted(), 'cancelled')).toEqual({ ok: true });
  });

  it('Reopen solved/cancelled → assigned with worker, unassigned without (§4)', () => {
    expect(reopenTarget(withWorker({ status: 'solved' }))).toBe('assigned');
    expect(reopenTarget(withWorker({ status: 'cancelled' }))).toBe('assigned');
    expect(reopenTarget(sorted({ status: 'cancelled' }))).toBe('unassigned');
    expect(reopenTarget(withWorker({ status: 'sent' }))).toBeNull();
  });

  it('Description of only spaces does not meet the requirement (discovered)', () => {
    expect(
      canMove(fresh({ categoryId: PAINT, description: '   ' }), 'unassigned'),
    ).toMatchObject({
      ok: false,
      missing: ['description'],
    });
  });
});

describe('applyPatch (§4 automatic moves)', () => {
  it('Patch category to one the worker lacks → worker removed, status unassigned (§6.3)', () => {
    const result = applyPatch(
      withWorker({ status: 'sent' }),
      { categoryId: ELEC },
      painter,
    );
    expect(result).toMatchObject({
      ok: true,
      state: { status: 'unassigned', categoryId: ELEC, workerId: null },
      statusChange: { from: 'sent', to: 'unassigned' },
      workerRemoved: true,
    });
  });

  it('Patch worker on unassigned → assigned; patch worker null on sent → unassigned (§4)', () => {
    expect(applyPatch(sorted(), { workerId: ALI }, painter)).toMatchObject({
      ok: true,
      state: { status: 'assigned', workerId: ALI },
      statusChange: { from: 'unassigned', to: 'assigned' },
    });
    expect(
      applyPatch(withWorker({ status: 'sent' }), { workerId: null }, noWorker),
    ).toMatchObject({
      ok: true,
      state: { status: 'unassigned', workerId: null },
      statusChange: { from: 'sent', to: 'unassigned' },
    });
  });

  it('Patch estimatedDate on assigned/sent → estimated; on in_progress → stays (§4)', () => {
    for (const status of ['assigned', 'sent'] as const) {
      expect(
        applyPatch(
          withWorker({ status }),
          { estimatedDate: '2026-11-10' },
          painter,
        ),
      ).toMatchObject({
        ok: true,
        state: { status: 'estimated', estimatedDate: '2026-11-10' },
        statusChange: { from: status, to: 'estimated' },
      });
    }
    expect(
      applyPatch(
        withWorker({ status: 'in_progress' }),
        { estimatedDate: '2026-11-10' },
        painter,
      ),
    ).toMatchObject({
      ok: true,
      state: { status: 'in_progress' },
      statusChange: null,
    });
  });

  it('Patch category + description on new → unassigned (§5.3); category only on new → stays new', () => {
    expect(
      applyPatch(fresh(), { categoryId: PAINT, description: 'Leak' }, noWorker),
    ).toMatchObject({
      ok: true,
      state: { status: 'unassigned' },
      statusChange: { from: 'new', to: 'unassigned' },
    });
    expect(applyPatch(fresh(), { categoryId: PAINT }, noWorker)).toMatchObject({
      ok: true,
      state: { status: 'new', categoryId: PAINT },
      statusChange: null,
    });
  });

  it('Patch categoryId null or description "" on a non-new issue → refused (§6.1)', () => {
    expect(applyPatch(sorted(), { categoryId: null }, noWorker)).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['category'],
    });
    expect(
      applyPatch(
        withWorker({ status: 'solved' }),
        { description: '' },
        painter,
      ),
    ).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['description'],
    });
  });

  it('Patch estimatedDate null on an estimated issue → refused (§6.4)', () => {
    expect(
      applyPatch(
        withWorker({ status: 'estimated', estimatedDate: '2026-11-10' }),
        { estimatedDate: null },
        painter,
      ),
    ).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['estimatedDate'],
    });
  });

  it('Patch a different worker (who has the category) on sent/in_progress → status unchanged (§4)', () => {
    const omar = { worker: { categoryIds: [ELEC, PAINT], active: true } };
    for (const status of ['sent', 'in_progress'] as const) {
      expect(
        applyPatch(withWorker({ status }), { workerId: OMAR }, omar),
      ).toMatchObject({
        ok: true,
        state: { status, workerId: OMAR },
        statusChange: null,
      });
    }
  });

  it('Choosing a worker who lacks the category → refused WORKER_LACKS_CATEGORY (discovered)', () => {
    const electrician = { worker: { categoryIds: [ELEC], active: true } };
    expect(applyPatch(sorted(), { workerId: OMAR }, electrician)).toEqual({
      ok: false,
      code: 'WORKER_LACKS_CATEGORY',
      missing: [],
    });
  });

  it('Choosing an inactive worker → refused INACTIVE_WORKER (discovered, §6.11)', () => {
    expect(
      applyPatch(
        sorted(),
        { workerId: OMAR },
        { worker: { categoryIds: [PAINT], active: false } },
      ),
    ).toMatchObject({ ok: false, code: 'INACTIVE_WORKER' });
  });

  it('Worker chosen on new without description → refused, missing description (discovered)', () => {
    expect(
      applyPatch(fresh({ categoryId: PAINT }), { workerId: ALI }, painter),
    ).toEqual({
      ok: false,
      code: 'ISSUE_REQUIREMENTS',
      missing: ['description'],
    });
  });

  it('Category + description + worker on new in one patch → assigned (discovered)', () => {
    expect(
      applyPatch(
        fresh(),
        { categoryId: PAINT, description: 'Leak', workerId: ALI },
        painter,
      ),
    ).toMatchObject({
      ok: true,
      state: { status: 'assigned' },
      statusChange: { from: 'new', to: 'assigned' },
    });
  });

  it('Category the worker lacks on a cancelled issue → worker removed, stays cancelled (discovered)', () => {
    expect(
      applyPatch(
        withWorker({ status: 'cancelled' }),
        { categoryId: ELEC },
        painter,
      ),
    ).toMatchObject({
      ok: true,
      state: { status: 'cancelled', workerId: null },
      statusChange: null,
      workerRemoved: true,
    });
  });

  it('Inactive current worker is kept when only the description changes (discovered, §3)', () => {
    expect(
      applyPatch(
        withWorker({ status: 'sent' }),
        { description: 'Bigger crack' },
        { worker: { categoryIds: [PAINT], active: false } },
      ),
    ).toMatchObject({
      ok: true,
      state: { workerId: ALI, description: 'Bigger crack' },
      statusChange: null,
    });
  });
});

describe('isOverdue (§4)', () => {
  const now = new Date('2026-11-05T10:00:00Z');

  it('Overdue: date yesterday & open → true; today → false; solved/cancelled → false; no date → false (§4)', () => {
    expect(
      isOverdue({ status: 'sent', estimatedDate: '2026-11-04' }, now),
    ).toBe(true);
    expect(
      isOverdue({ status: 'sent', estimatedDate: '2026-11-05' }, now),
    ).toBe(false);
    expect(
      isOverdue({ status: 'solved', estimatedDate: '2026-11-04' }, now),
    ).toBe(false);
    expect(
      isOverdue({ status: 'cancelled', estimatedDate: '2026-11-04' }, now),
    ).toBe(false);
    expect(isOverdue({ status: 'sent', estimatedDate: null }, now)).toBe(false);
  });

  it('Overdue uses Cairo date at 23:30 UTC boundary (§4 Cairo)', () => {
    const lateUtc = new Date('2026-11-05T23:30:00Z'); // 01:30 on the 6th in Cairo (UTC+2)
    expect(todayInCairo(lateUtc)).toBe('2026-11-06');
    expect(
      isOverdue({ status: 'estimated', estimatedDate: '2026-11-05' }, lateUtc),
    ).toBe(true);
  });

  it('Cairo summer time (UTC+3) shifts the date at 21:30 UTC (discovered)', () => {
    expect(todayInCairo(new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
  });
});

describe('normalizeEgyptPhone (§3)', () => {
  it('Phone 01012345678 → +201012345678; +201012345678 stays; 00201… → +20…; letters → invalid (§3)', () => {
    expect(normalizeEgyptPhone('01012345678')).toBe('+201012345678');
    expect(normalizeEgyptPhone('+201012345678')).toBe('+201012345678');
    expect(normalizeEgyptPhone('00201012345678')).toBe('+201012345678');
    expect(normalizeEgyptPhone('010abc45678')).toBeNull();
  });

  it('Spaces, dashes, Arabic-Indic digits and a stray trunk zero are accepted (discovered)', () => {
    expect(normalizeEgyptPhone(' 010 1234-5678 ')).toBe('+201012345678');
    expect(normalizeEgyptPhone('٠١٠١٢٣٤٥٦٧٨')).toBe('+201012345678');
    expect(normalizeEgyptPhone('+20 010 1234 5678')).toBe('+201012345678');
    expect(normalizeEgyptPhone('0223456789')).toBe('+20223456789');
  });

  it('Too short, too long and non-Egyptian numbers → invalid (discovered)', () => {
    expect(normalizeEgyptPhone('0101234567')).toBeNull();
    expect(normalizeEgyptPhone('010123456789')).toBeNull();
    expect(normalizeEgyptPhone('+966501234567')).toBeNull();
    expect(normalizeEgyptPhone('')).toBeNull();
  });
});

describe('CSV (§7)', () => {
  it("CSV cell starting = + - @ → prefixed with '; quotes/commas/newlines escaped (§7)", () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell('+201012345678')).toBe("'+201012345678");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('=1,2')).toBe(`"'=1,2"`);
  });

  it('toCsv starts with the BOM, CRLF rows, null → empty, numbers unguarded (discovered)', () => {
    const csv = toCsv(
      [['شقة 3', null, -2, true]],
      ['الموقع', 'notes', 'n', 'overdue'],
    );
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1)).toBe('الموقع,notes,n,overdue\r\nشقة 3,,-2,true\r\n');
  });

  it('formatCairoDateTime → YYYY-MM-DD HH:mm in Cairo; missing → empty (discovered)', () => {
    expect(formatCairoDateTime('2026-11-05T22:05:00Z')).toBe(
      '2026-11-06 00:05',
    );
    expect(formatCairoDateTime(new Date('2026-07-01T09:00:00Z'))).toBe(
      '2026-07-01 12:00',
    );
    expect(formatCairoDateTime(null)).toBe('');
  });
});

describe('WhatsApp (§5.5)', () => {
  const issue: WhatsAppIssue = {
    number: 14,
    site: { name: 'Palm Hills B2' },
    location: 'Floor 3, flat 302',
    category: { nameAr: 'نقاشة', nameEn: 'Painting' },
    description: 'Cracked paint by the window',
    priority: 'high',
    photos: [
      { kind: 'before', url: 'https://blob.example/b.jpg', sortOrder: 1 },
      { kind: 'before', url: 'https://blob.example/a.jpg', sortOrder: 0 },
      { kind: 'after', url: 'https://blob.example/after.jpg', sortOrder: 0 },
    ],
  };

  it('WhatsApp message (ar and en) contains site, #number, location, category, description, priority and every photo link; empty location/description lines omitted; wa.me URL uses the phone without + and encodes the text (§5.5)', () => {
    const en = buildIssueMessage(issue, 'en');
    for (const part of [
      'Palm Hills B2',
      '#14',
      'Floor 3, flat 302',
      'Painting',
      'Cracked paint by the window',
      'High',
      'https://blob.example/a.jpg',
      'https://blob.example/b.jpg',
    ]) {
      expect(en).toContain(part);
    }
    expect(en.indexOf('a.jpg')).toBeLessThan(en.indexOf('b.jpg'));

    const ar = buildIssueMessage(issue, 'ar');
    for (const part of [
      'Palm Hills B2',
      '#14',
      'نقاشة',
      'عالية',
      'الموقع',
      'https://blob.example/a.jpg',
      'https://blob.example/b.jpg',
    ]) {
      expect(ar).toContain(part);
    }

    const bare = buildIssueMessage(
      { ...issue, location: null, description: '  ' },
      'en',
    );
    expect(bare).not.toContain('Location');
    expect(bare).not.toContain('Description');
    expect(bare).not.toMatch(/\n\n/);

    const url = waMeUrl('+20 101 234 5678', 'Hi & #14\nok');
    expect(url).toBe('https://wa.me/201012345678?text=Hi%20%26%20%2314%0Aok');
  });

  it('Batch message lists every issue with its number (§5.5)', () => {
    const text = buildBatchMessage(
      [issue, { ...issue, number: 15 }, { ...issue, number: 21 }],
      { name: 'Ali' },
      'ar',
    );
    expect(text).toContain('Ali');
    for (const n of ['#14', '#15', '#21']) expect(text).toContain(n);
  });

  it('After-photos are left out; relative photo URLs get the base URL (discovered)', () => {
    const local = {
      ...issue,
      photos: [
        { kind: 'before' as const, url: '/uploads/x.jpg', sortOrder: 0 },
      ],
    };
    expect(buildIssueMessage(issue, 'en')).not.toContain('after.jpg');
    expect(
      buildIssueMessage(local, 'en', { baseUrl: 'http://localhost:3101/' }),
    ).toContain('http://localhost:3101/uploads/x.jpg');
  });

  it('English message falls back to the Arabic category name (discovered)', () => {
    expect(
      buildIssueMessage(
        { ...issue, category: { nameAr: 'نقاشة', nameEn: null } },
        'en',
      ),
    ).toContain('Category: نقاشة');
  });
});

describe('labels', () => {
  it('status/priority label keys and priority rank', () => {
    expect(statusLabelKey('in_progress')).toBe('status.in_progress');
    expect(priorityLabelKey('urgent')).toBe('priority.urgent');
    expect(priorityRank('urgent')).toBeGreaterThan(priorityRank('low'));
  });
});
