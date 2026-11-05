import { PAGE_LIMIT_MAX } from '@muayana/shared';
import type { ModelDelegate } from '../interfaces/repository.interface';
import { BaseRepository } from './base.repository';

interface Row {
  id: string;
}
type Where = { name?: string; OR?: object[] };

class RowRepository extends BaseRepository<Row, Row, Partial<Row>, Where> {
  constructor(model: ModelDelegate<Row, Row, Partial<Row>, Where>) {
    super(model);
  }
}

function makeRepo(total: number) {
  const model = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([{ id: 'a' }]),
    count: jest.fn().mockResolvedValue(total),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return { repo: new RowRepository(model), model };
}

describe('BaseRepository.findAllWithPagination', () => {
  it('pages with skip/take and reports the page shape', async () => {
    const { repo, model } = makeRepo(45);
    const page = await repo.findAllWithPagination(2, 20);
    expect(model.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 20,
      take: 20,
    });
    expect(page).toEqual({
      data: [{ id: 'a' }],
      total: 45,
      page: 2,
      limit: 20,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it(`caps limit at ${PAGE_LIMIT_MAX}`, async () => {
    const { repo, model } = makeRepo(0);
    const page = await repo.findAllWithPagination(1, 10_000);
    expect(page.limit).toBe(PAGE_LIMIT_MAX);
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: PAGE_LIMIT_MAX }),
    );
  });

  it('clamps a page below 1 to the first page', async () => {
    const { repo } = makeRepo(3);
    const page = await repo.findAllWithPagination(0, 20);
    expect(page).toMatchObject({ page: 1, hasPreviousPage: false });
  });

  it('a page beyond the end is empty-capable and has no next page', async () => {
    const { repo } = makeRepo(3);
    const page = await repo.findAllWithPagination(5, 20);
    expect(page).toMatchObject({ page: 5, hasNextPage: false });
  });

  it('searches the given fields case-insensitively, keeping the scope', async () => {
    const { repo, model } = makeRepo(1);
    await repo.findAllWithPagination(1, 20, 'tower', ['name', 'address'], {
      name: 'x',
    });
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name: 'x',
          OR: [
            { name: { contains: 'tower', mode: 'insensitive' } },
            { address: { contains: 'tower', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});
