import { CSV_BOM } from '@muayana/shared';
import { emptyTally } from '../../common/utils/issue-counts.util';
import {
  newlyAddedInactive,
  phoneSearchDigits,
  toWorker,
  workersCsv,
} from './workers.pure';

const row = {
  id: 'w1',
  name: 'Ahmed',
  phone: '+201012345678',
  notes: '@cmd',
  active: false,
  categories: [
    {
      category: {
        id: 'c2',
        nameAr: 'كهرباء',
        nameEn: null,
        color: '#000000',
        sortOrder: 2,
      },
    },
    {
      category: {
        id: 'c1',
        nameAr: 'نقاشة',
        nameEn: 'Painting',
        color: '#111111',
        sortOrder: 1,
      },
    },
  ],
};

describe('toWorker', () => {
  it('orders categories by sort order and derives open from the status counts', () => {
    const worker = toWorker(
      row,
      { ...emptyTally(), assigned: 1, estimated: 2, solved: 5 },
      1,
    );
    expect(worker.categories.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(worker.categories[0]).toEqual({
      id: 'c1',
      nameAr: 'نقاشة',
      nameEn: 'Painting',
      color: '#111111',
    });
    expect(worker.counts).toEqual({
      assigned: 1,
      sent: 0,
      estimated: 2,
      in_progress: 0,
      solved: 5,
      open: 3,
      overdue: 1,
    });
  });
});

describe('phoneSearchDigits', () => {
  it.each([
    ['010 12', '1012'],
    ['+20 10', '2010'],
    ['٠١٠١٢', '1012'],
    ['Ahmed', null],
    ['000', null],
  ])('%s → %s', (search, digits) => {
    expect(phoneSearchDigits(search)).toBe(digits);
  });
});

describe('newlyAddedInactive', () => {
  it('flags only inactive categories the worker does not already have', () => {
    expect(
      newlyAddedInactive(
        [
          { id: 'kept', active: false },
          { id: 'new-off', active: false },
          { id: 'new-on', active: true },
        ],
        ['kept'],
      ),
    ).toEqual(['new-off']);
  });
});

describe('workersCsv', () => {
  const worker = toWorker(row, { ...emptyTally(), sent: 1 }, 0);

  it('Arabic headers, BOM, formula-guarded text, category names joined', () => {
    const text = workersCsv([worker], 'ar');
    expect(text.startsWith(CSV_BOM)).toBe(true);
    const [header, line] = text.slice(1).split('\r\n');
    expect(header.split(',')[0]).toBe('الاسم');
    expect(line).toBe(
      "Ahmed,'+201012345678,نقاشة / كهرباء,لا,'@cmd,0,1,0,0,0,1,0",
    );
  });

  it('English headers and English category names, falling back to Arabic', () => {
    const [header, line] = workersCsv([worker], 'en').slice(1).split('\r\n');
    expect(header.split(',')).toHaveLength(12);
    expect(header.startsWith('Name,Phone,Categories')).toBe(true);
    expect(line).toContain(',Painting / كهرباء,No,');
  });

  it('no workers → the header row only', () => {
    const lines = workersCsv([], 'en').slice(1).split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});
