import { Injectable } from '@nestjs/common';
import type { IssueStatus, Prisma } from '@prisma/client';
import type { Paginated } from '../../../common/interfaces/api-response.interface';
import type { Tx } from '../../../common/interfaces/transaction.interface';
import type { StatusCountRow } from '../../../common/utils/issue-counts.util';
import { overdueWhere } from '../../../common/utils/issue-filter.util';
import { pageWindow, toPage } from '../../../common/utils/pagination.util';
import { DatabaseService } from '../../../database/database.service';

/** Every worker column the API shows, with his categories (as CategoryRef + order). */
export const WORKER_SELECT = {
  id: true,
  name: true,
  phone: true,
  notes: true,
  active: true,
  categories: {
    select: {
      category: {
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          color: true,
          sortOrder: true,
        },
      },
    },
  },
} satisfies Prisma.WorkerSelect;

export type WorkerRow = Prisma.WorkerGetPayload<{
  select: typeof WORKER_SELECT;
}>;

export interface WorkerFilter {
  active?: boolean;
  categoryId?: string;
  /** Matched against the name. */
  search?: string;
  /** Digits matched against the phone (see phoneSearchDigits). */
  phoneDigits?: string;
}

export interface WorkerWrite {
  name?: string;
  phone?: string;
  notes?: string | null;
  active?: boolean;
}

const ORDER: Prisma.WorkerOrderByWithRelationInput[] = [
  { name: 'asc' },
  { id: 'asc' },
];

function toWhere(filter: WorkerFilter): Prisma.WorkerWhereInput {
  const where: Prisma.WorkerWhereInput = { active: filter.active };
  if (filter.categoryId)
    where.categories = { some: { categoryId: filter.categoryId } };
  if (filter.search) {
    where.OR = [{ name: { contains: filter.search, mode: 'insensitive' } }];
    if (filter.phoneDigits)
      where.OR.push({ phone: { contains: filter.phoneDigits } });
  }
  return where;
}

@Injectable()
export class WorkersRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(
    filter: WorkerFilter,
    page: number,
    limit: number,
  ): Promise<Paginated<WorkerRow>> {
    const window = pageWindow(page, limit);
    const where = toWhere(filter);
    const [rows, total] = await Promise.all([
      this.db.worker.findMany({
        where,
        select: WORKER_SELECT,
        orderBy: ORDER,
        skip: window.skip,
        take: window.take,
      }),
      this.db.worker.count({ where }),
    ]);
    return toPage(rows, total, window);
  }

  /** Every worker matching the filter, unpaged (the CSV export). */
  listAll(filter: WorkerFilter): Promise<WorkerRow[]> {
    return this.db.worker.findMany({
      where: toWhere(filter),
      select: WORKER_SELECT,
      orderBy: ORDER,
    });
  }

  findById(id: string, tx: Tx = this.db): Promise<WorkerRow | null> {
    return tx.worker.findUnique({ where: { id }, select: WORKER_SELECT });
  }

  /** Another worker with this (normalised) phone. */
  findByPhone(
    phone: string,
    exceptId?: string,
  ): Promise<{ id: string } | null> {
    return this.db.worker.findFirst({
      where: { phone, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
  }

  /** The categories among `ids` that exist, with their active flag. */
  findCategories(ids: string[]): Promise<{ id: string; active: boolean }[]> {
    return this.db.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, active: true },
    });
  }

  create(
    data: WorkerWrite & { name: string; phone: string },
    categoryIds: string[],
  ): Promise<WorkerRow> {
    return this.db.worker.create({
      data: {
        ...data,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      select: WORKER_SELECT,
    });
  }

  /** Updates the worker and, when given, replaces his categories — all or nothing. */
  async update(
    id: string,
    data: WorkerWrite,
    categoryIds: string[] | undefined,
    tx: Tx,
  ): Promise<void> {
    await tx.worker.update({ where: { id }, data });
    if (categoryIds === undefined) return;
    await tx.workerCategory.deleteMany({
      where: { workerId: id, categoryId: { notIn: categoryIds } },
    });
    await tx.workerCategory.createMany({
      data: categoryIds.map((categoryId) => ({ workerId: id, categoryId })),
      skipDuplicates: true,
    });
  }

  // ------------------------------------------------- permanent delete (§3)

  /** Locks the worker's row until the transaction ends; his name, or null when he is gone. */
  async lockForDelete(
    tx: Tx,
    id: string,
  ): Promise<{ id: string; name: string } | null> {
    const rows = await tx.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM workers WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** His issues per status, and the photos they hold. */
  async issueFootprint(
    tx: Tx,
    workerId: string,
  ): Promise<{ byStatus: StatusCountRow[]; photos: number }> {
    // One after the other: a transaction holds a single connection.
    const byStatus = await tx.issue.groupBy({
      by: ['status'],
      where: { workerId },
      _count: { _all: true },
    });
    const photos = await tx.photo.count({ where: { issue: { workerId } } });
    return {
      byStatus: byStatus.map((row) => ({
        key: workerId,
        status: row.status,
        count: row._count._all,
      })),
      photos,
    };
  }

  /**
   * "Keep the issues": his open ones (any status but `closed`) go back to `unassigned` with the
   * estimate cleared and one history row each carrying `note`; the closed ones keep their status,
   * lose him and keep `name` as a record (§3, §6.2, §6.7).
   */
  async releaseIssues(
    tx: Tx,
    workerId: string,
    name: string,
    closed: readonly IssueStatus[],
    note: string,
  ): Promise<void> {
    const open = await tx.issue.findMany({
      where: { workerId, status: { notIn: [...closed] } },
      select: { id: true, status: true },
    });
    if (open.length > 0) {
      await tx.issue.updateMany({
        where: { id: { in: open.map((i) => i.id) } },
        data: { status: 'unassigned', workerId: null, estimatedDate: null },
      });
      await tx.statusChange.createMany({
        data: open.map((i) => ({
          issueId: i.id,
          from: i.status,
          to: 'unassigned' as const,
          note,
        })),
      });
    }
    await tx.issue.updateMany({
      where: { workerId, status: { in: [...closed] } },
      data: { workerId: null, formerWorkerName: name },
    });
  }

  /** The storage keys of every photo on his issues (read before they are deleted). */
  async photoKeysOfIssues(tx: Tx, workerId: string): Promise<string[]> {
    const photos = await tx.photo.findMany({
      where: { issue: { workerId } },
      select: { storageKey: true },
    });
    return photos.map((p) => p.storageKey);
  }

  /** "Delete his issues too": every issue he has, with photos and history (they cascade). */
  async deleteIssues(tx: Tx, workerId: string): Promise<void> {
    await tx.issue.deleteMany({ where: { workerId } });
  }

  /** Removes the worker; his category links cascade. */
  async delete(tx: Tx, id: string): Promise<void> {
    await tx.worker.delete({ where: { id } });
  }

  /** Issue counts per worker and status, and overdue per worker, for `workerIds`. */
  async issueCounts(
    workerIds: string[],
    now: Date,
  ): Promise<{ byStatus: StatusCountRow[]; overdue: Map<string, number> }> {
    if (workerIds.length === 0) return { byStatus: [], overdue: new Map() };
    const scope = { workerId: { in: workerIds } };
    const [byStatus, overdue] = await Promise.all([
      this.db.issue.groupBy({
        by: ['workerId', 'status'],
        where: scope,
        _count: { _all: true },
      }),
      this.db.issue.groupBy({
        by: ['workerId'],
        where: { ...scope, ...overdueWhere(now) },
        _count: { _all: true },
      }),
    ]);
    return {
      byStatus: byStatus.flatMap((row) =>
        row.workerId
          ? [{ key: row.workerId, status: row.status, count: row._count._all }]
          : [],
      ),
      overdue: new Map(
        overdue.flatMap((row) =>
          row.workerId ? [[row.workerId, row._count._all] as const] : [],
        ),
      ),
    };
  }
}
