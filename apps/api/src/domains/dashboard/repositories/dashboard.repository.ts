import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { overdueWhere } from '../../../common/utils/issue-filter.util';
import { DatabaseService } from '../../../database/database.service';
import type { IssueGroup, OverdueGroup } from '../dashboard.pure';

/** Every Prisma call of the dashboard: two grouped counts and the refs they name. */
@Injectable()
export class DashboardRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Issue counts per site × category × worker × status, and overdue counts per site × category
   * × worker, inside `scope`. Two queries whatever the data size (no per-row lookups).
   */
  async issueGroups(
    scope: Prisma.IssueWhereInput,
    now: Date,
  ): Promise<{ groups: IssueGroup[]; overdue: OverdueGroup[] }> {
    const [groups, overdue] = await Promise.all([
      this.db.issue.groupBy({
        by: ['siteId', 'categoryId', 'workerId', 'status'],
        where: scope,
        _count: { _all: true },
      }),
      this.db.issue.groupBy({
        by: ['siteId', 'categoryId', 'workerId'],
        where: { AND: [scope, overdueWhere(now)] },
        _count: { _all: true },
      }),
    ]);
    return {
      groups: groups.map(({ _count, ...keys }) => ({
        ...keys,
        count: _count._all,
      })),
      overdue: overdue.map(({ _count, ...keys }) => ({
        ...keys,
        count: _count._all,
      })),
    };
  }

  categories(ids: string[]) {
    return this.db.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, nameAr: true, nameEn: true, color: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  workers(ids: string[]) {
    return this.db.worker.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, phone: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  /** Active (not archived) sites, or the one asked for when it is active. */
  activeSites(siteId?: string) {
    return this.db.site.findMany({
      where: { archived: false, ...(siteId && { id: siteId }) },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}
