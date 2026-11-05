import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CATEGORY_MAX_COUNT,
  DomainErrorCode,
  ErrorCode,
  nameKey,
  type Category,
  type Deleted,
} from '@muayana/shared';
import {
  domainConflict,
  isUniqueViolation,
} from '../../common/utils/domain-error.util';
import { blankToNull } from '../../common/utils/text.util';
import { DatabaseService } from '../../database/database.service';
import { reorderProblem } from './categories.pure';
import { CategoryListQueryDto } from './dto/category-list-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  CategoriesRepository,
  type CategoryRow,
} from './repositories/categories.repository';

const duplicateName = () =>
  domainConflict(
    DomainErrorCode.DUPLICATE,
    'Another category already has this Arabic name',
  );

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly db: DatabaseService,
  ) {}

  async list(query: CategoryListQueryDto): Promise<Category[]> {
    return this.withCounts(
      await this.categories.list(query.active === 'true'),
    );
  }

  /** Arabic names unique ignoring case and spaces (business §3); at most 100 (contract). */
  async create(dto: CreateCategoryDto): Promise<Category> {
    if ((await this.categories.count()) >= CATEGORY_MAX_COUNT)
      throw new ConflictException({
        message: `At most ${CATEGORY_MAX_COUNT} categories`,
        error: ErrorCode.CONFLICT,
      });
    const key = nameKey(dto.nameAr);
    if (await this.categories.findByNameKey(key)) throw duplicateName();
    const row = await this.saving(() =>
      this.categories.create({
        nameAr: dto.nameAr,
        nameKey: key,
        nameEn: blankToNull(dto.nameEn),
        color: dto.color,
      }),
    );
    return this.one(row);
  }

  /** Rename, recolour, (de)activate. A deactivated category stays on issues and workers. */
  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOrThrow(id);
    const key = dto.nameAr === undefined ? undefined : nameKey(dto.nameAr);
    if (key && (await this.categories.findByNameKey(key, id)))
      throw duplicateName();
    const row = await this.saving(() =>
      this.categories.update(id, {
        nameAr: dto.nameAr,
        nameKey: key,
        nameEn: blankToNull(dto.nameEn),
        color: dto.color,
        active: dto.active,
      }),
    );
    return this.one(row);
  }

  /** `ids` must be every category exactly once; returns all categories in the new order. */
  async reorder(dto: ReorderCategoriesDto): Promise<Category[]> {
    const rows = await this.db.transaction(async (tx) => {
      const problem = reorderProblem(dto.ids, await this.categories.allIds(tx));
      if (problem)
        throw new BadRequestException({
          message: problem,
          error: ErrorCode.VALIDATION_FAILED,
        });
      await this.categories.setSortOrders(dto.ids, tx);
      return this.categories.list(false, tx);
    });
    return this.withCounts(rows);
  }

  /** A category on an issue or a worker is deactivated, never deleted (business §6.8). */
  async remove(id: string): Promise<Deleted> {
    await this.findOrThrow(id);
    if (await this.categories.isInUse(id))
      throw domainConflict(
        DomainErrorCode.IN_USE,
        'This category is used by issues or workers: deactivate it instead',
      );
    await this.categories.delete(id);
    return { id };
  }

  private async findOrThrow(id: string): Promise<CategoryRow> {
    const row = await this.categories.findById(id);
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  /** A write that can still lose a race to the unique name index answers DUPLICATE. */
  private async saving(write: () => Promise<CategoryRow>): Promise<CategoryRow> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateName();
      throw error;
    }
  }

  private async one(row: CategoryRow): Promise<Category> {
    const [category] = await this.withCounts([row]);
    return category;
  }

  private async withCounts(rows: CategoryRow[]): Promise<Category[]> {
    const { open, workers } = await this.categories.counts(
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...row,
      counts: { open: open.get(row.id) ?? 0, workers: workers.get(row.id) ?? 0 },
    }));
  }
}
