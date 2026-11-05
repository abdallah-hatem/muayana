import { ConflictException, HttpStatus } from '@nestjs/common';
import { DomainErrorCode } from '@muayana/shared';
import sharp from 'sharp';
import type { Clock } from '../../common/clock/clock';
import type { PhotoStorage } from '../../common/storage/photo-storage.interface';
import { IssuesService } from './issues.service';
import type { IssueRefsRepository } from './repositories/issue-refs.repository';
import type {
  IssueRepository,
  IssueRow,
  IssueStateRow,
} from './repositories/issue.repository';

const NOW = new Date('2026-11-05T12:00:00Z');
const ID = '11111111-1111-4111-8111-111111111111';
const SITE = '22222222-2222-4222-8222-222222222222';

const row = (over: Partial<IssueRow> = {}): IssueRow =>
  ({
    id: ID,
    siteId: SITE,
    number: 1,
    status: 'new',
    priority: 'normal',
    description: null,
    location: null,
    estimatedDate: null,
    capturedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    assignedAt: null,
    sentAt: null,
    solvedAt: null,
    site: { id: SITE, name: 'Tower' },
    category: null,
    worker: null,
    photos: [],
    ...over,
  });

const stateRow = (over: Partial<IssueStateRow> = {}): IssueStateRow => ({
  id: ID,
  status: 'assigned',
  categoryId: 'cat',
  description: 'x',
  workerId: 'w',
  estimatedDate: null,
  assignedAt: NOW,
  sentAt: null,
  solvedAt: null,
  ...over,
});

function makeService(
  over: {
    existing?: IssueRow | null;
    site?: { archived: boolean } | null;
  } = {},
) {
  const tx = {};
  const issues = {
    findById: jest.fn().mockResolvedValue(over.existing ?? null),
    findManyByIds: jest.fn().mockResolvedValue([]),
    transaction: jest.fn((work: (t: unknown) => unknown) => work(tx)),
    takeNextNumber: jest.fn().mockResolvedValue({ number: 1, archived: false }),
    createIssue: jest.fn(),
    createPhoto: jest.fn(),
    addStatusChange: jest.fn(),
    update: jest.fn(),
    lockStates: jest.fn().mockResolvedValue([]),
  };
  const refs = {
    findSite: jest
      .fn()
      .mockResolvedValue(
        over.site === undefined ? { id: SITE, archived: false } : over.site,
      ),
    findCategory: jest.fn(),
    findWorker: jest.fn(),
    findWorkers: jest.fn().mockResolvedValue(new Map()),
  };
  const storage: jest.Mocked<PhotoStorage> = {
    put: jest.fn().mockResolvedValue({ key: 'k', url: 'u' }),
    delete: jest.fn(),
  };
  const clock: Clock = { now: () => NOW };
  const service = new IssuesService(
    issues as unknown as IssueRepository,
    refs as unknown as IssueRefsRepository,
    storage,
    clock,
  );
  return { service, issues, refs, storage };
}

const dto = {
  id: ID,
  siteId: SITE,
  capturedAt: '2026-11-05T10:00:00.000Z',
};

let photo: { buffer: Buffer; size: number };
beforeAll(async () => {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#000' },
  })
    .jpeg()
    .toBuffer();
  photo = { buffer, size: buffer.length };
});

describe('IssuesService.create', () => {
  it('an existing id answers 200 with it and stores nothing', async () => {
    const { service, storage, issues } = makeService({ existing: row() });
    const result = await service.create(dto, photo);
    expect(result.status).toBe(HttpStatus.OK);
    expect(result.body.id).toBe(ID);
    expect(storage.put).not.toHaveBeenCalled();
    expect(issues.transaction).not.toHaveBeenCalled();
  });

  it('an archived site is refused before anything is stored', async () => {
    const { service, storage } = makeService({ site: { archived: true } });
    await expect(service.create(dto, photo)).rejects.toMatchObject({
      response: { error: DomainErrorCode.ARCHIVED_SITE },
    });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('a failed transaction deletes the stored file', async () => {
    const { service, storage, issues } = makeService();
    issues.createIssue.mockRejectedValue(new Error('db down'));
    await expect(service.create(dto, photo)).rejects.toThrow('db down');
    expect(storage.delete).toHaveBeenCalledWith('k');
  });

  it('creates in new with number, photo and the creation history row', async () => {
    const { service, issues } = makeService();
    issues.findById.mockResolvedValueOnce(null).mockResolvedValue(row());
    const result = await service.create(dto, photo);
    expect(result.status).toBe(HttpStatus.CREATED);
    expect(issues.createIssue).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: ID, number: 1 }),
    );
    expect(issues.addStatusChange).toHaveBeenCalledWith(
      {},
      { issueId: ID, from: null, to: 'new' },
    );
  });
});

describe('IssuesService.bulk', () => {
  it('one refused issue → 409 listing it and nothing written', async () => {
    const { service, issues } = makeService();
    const other = '33333333-3333-4333-8333-333333333333';
    issues.lockStates.mockResolvedValue([
      stateRow(),
      stateRow({ id: other, status: 'new', categoryId: null, workerId: null }),
    ]);
    const error = await service
      .bulk({ ids: [ID, other], status: 'sent' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: DomainErrorCode.ISSUE_REQUIREMENTS,
      data: { ids: [other] },
    });
    expect(issues.update).not.toHaveBeenCalled();
    expect(issues.addStatusChange).not.toHaveBeenCalled();
  });

  it('nothing to change → 400', async () => {
    const { service } = makeService();
    await expect(service.bulk({ ids: [ID] })).rejects.toMatchObject({
      status: 400,
    });
  });
});
