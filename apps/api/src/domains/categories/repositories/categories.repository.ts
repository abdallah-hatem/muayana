import { Injectable } from '@nestjs/common';
import { OPEN_STATUSES } from '@muayana/shared';
import type { Prisma } from '@prisma/client';
import type { Tx } from '../../../common/interfaces/transaction.interface';
import { DatabaseService } from '../../../database/database.service';

/** Every category column the API shows. */
export const CATEGORY_SELECT = {
  id: true,
  nameAr: true,
  nameEn: true,
  color: true,
  sortOrder: true,
  active: true,
} satisfies Prisma.CategorySelect;

export type CategoryRow = Prisma.CategoryGetPayload<{
  select: typeof CATEGORY_SELECT;
}>;

export interface CategoryWrite {
  nameAr?: string;
  nameKey?: string;
  nameEn?: string | null;
  color?: string;
  active?: boolean;
}

/** Display order: sortOrder, then Arabic name as a stable tie-break. */
const ORDER: Prisma.CategoryOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { nameAr: 'asc' },
];

@Injectable()
export class CategoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  list(activeOnly: boolean, tx: Tx = this.db): Promise<CategoryRow[]> {
    return tx.category.findMany({
      where: activeOnly ? { active: true } : undefined,
      select: CATEGORY_SELECT,
      orderBy: ORDER,
    });
  }

  findById(id: string): Promise<CategoryRow | null> {
    return this.db.category.findUnique({
      where: { id },
      select: CATEGORY_SELECT,
    });
  }

  /** Another category with this Arabic name key. */
  findByNameKey(
    nameKey: string,
    exceptId?: string,
  ): Promise<{ id: string } | null> {
    return this.db.category.findFirst({
      where: { nameKey, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
  }

  count(): Promise<number> {
    return this.db.category.count();
  }

  async allIds(tx: Tx): Promise<string[]> {
    const rows = await tx.category.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }

  /** A new category goes to the end of the order. */
  async create(
    data: CategoryWrite & { nameAr: string; nameKey: string; color: string },
  ): Promise<CategoryRow> {
    const last = await this.db.category.aggregate({ _max: { sortOrder: true } });
    return this.db.category.create({
      data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      select: CATEGORY_SELECT,
    });
  }

  update(id: string, data: CategoryWrite): Promise<CategoryRow> {
    return this.db.category.update({
      where: { id },
      data,
      select: CATEGORY_SELECT,
    });
  }

  async setSortOrders(ids: string[], tx: Tx): Promise<void> {
    for (const [index, id] of ids.entries())
      await tx.category.update({ where: { id }, data: { sortOrder: index } });
  }

  async delete(id: string): Promise<void> {
    await this.db.category.delete({ where: { id } });
  }

  /** Is the category on any issue or any worker (business §3: then deactivate, never delete)? */
  async isInUse(id: string): Promise<boolean> {
    const [issues, workers] = await Promise.all([
      this.db.issue.count({ where: { categoryId: id } }),
      this.db.workerCategory.count({ where: { categoryId: id } }),
    ]);
    return issues + workers > 0;
  }

  /** Open issues and active workers per category, for `ids`. */
  async counts(
    ids: string[],
  ): Promise<{ open: Map<string, number>; workers: Map<string, number> }> {
    if (ids.length === 0) return { open: new Map(), workers: new Map() };
    const [open, workers] = await Promise.all([
      this.db.issue.groupBy({
        by: ['categoryId'],
        where: { categoryId: { in: ids }, status: { in: [...OPEN_STATUSES] } },
        _count: { _all: true },
      }),
      this.db.workerCategory.groupBy({
        by: ['categoryId'],
        where: { categoryId: { in: ids }, worker: { active: true } },
        _count: { _all: true },
      }),
    ]);
    return {
      open: new Map(
        open.flatMap((row) =>
          row.categoryId ? [[row.categoryId, row._count._all] as const] : [],
        ),
      ),
      workers: new Map(workers.map((row) => [row.categoryId, row._count._all])),
    };
  }
}
