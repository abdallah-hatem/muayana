import { PAGE_LIMIT_DEFAULT } from '@muayana/shared';
import type { Paginated } from '../interfaces/api-response.interface';
import type {
  IRepository,
  ModelDelegate,
} from '../interfaces/repository.interface';
import { pageWindow, toPage } from '../utils/pagination.util';

/**
 * Every Prisma call lives in a repository; this is the shared base.
 *
 * @example
 * @Injectable()
 * export class SiteRepository extends BaseRepository<Site, Prisma.SiteCreateInput,
 *   Prisma.SiteUpdateInput, Prisma.SiteWhereInput> {
 *   constructor(db: DatabaseService) { super(db.site); }
 * }
 *
 * Scope (archived, active) belongs in the subclass's overrides, never at call sites.
 * Repositories return null for "not there"; the service decides whether that is a 404.
 */
export abstract class BaseRepository<
  T,
  CreateInput,
  UpdateInput,
  Where extends object = object,
> implements IRepository<T, CreateInput, UpdateInput> {
  protected constructor(
    protected readonly model: ModelDelegate<T, CreateInput, UpdateInput, Where>,
  ) {}

  async create(data: CreateInput): Promise<T> {
    return this.model.create({ data });
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  /**
   * Paginated list with an optional case-insensitive search across `searchFields`.
   * `limit` is capped at PAGE_LIMIT_MAX (100, contract) by pageWindow, so no query string can
   * ask for more rows.
   */
  async findAllWithPagination(
    page = 1,
    limit = PAGE_LIMIT_DEFAULT,
    search?: string,
    searchFields: string[] = [],
    where?: Where,
  ): Promise<Paginated<T>> {
    const window = pageWindow(page, limit);

    const condition = { ...where } as Where & { OR?: object[] };
    if (search && searchFields.length) {
      condition.OR = searchFields.map((field) => ({
        [field]: { contains: search, mode: 'insensitive' },
      }));
    }

    const [data, total] = await Promise.all([
      this.model.findMany({
        where: condition,
        skip: window.skip,
        take: window.take,
      }),
      this.model.count({ where: condition }),
    ]);

    return toPage(data, total, window);
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.model.delete({ where: { id } });
  }
}
