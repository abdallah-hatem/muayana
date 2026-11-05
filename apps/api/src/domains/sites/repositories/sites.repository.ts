import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Paginated } from '../../../common/interfaces/api-response.interface';
import type { Tx } from '../../../common/interfaces/transaction.interface';
import {
  overdueIssueWhere,
  type StatusCountRow,
} from '../../../common/utils/issue-counts.util';
import { pageWindow, toPage } from '../../../common/utils/pagination.util';
import { DatabaseService } from '../../../database/database.service';

/** Every site column the API shows. */
export const SITE_SELECT = {
  id: true,
  name: true,
  address: true,
  notes: true,
  archived: true,
  createdAt: true,
  nextNumber: true,
} satisfies Prisma.SiteSelect;

export type SiteRow = Prisma.SiteGetPayload<{ select: typeof SITE_SELECT }>;

export interface SiteListFilter {
  archived?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface SiteWrite {
  name?: string;
  nameKey?: string;
  address?: string | null;
  notes?: string | null;
  archived?: boolean;
}

@Injectable()
export class SitesRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(filter: SiteListFilter): Promise<Paginated<SiteRow>> {
    const window = pageWindow(filter.page, filter.limit);
    const where: Prisma.SiteWhereInput = { archived: filter.archived };
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { address: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.db.site.findMany({
        where,
        select: SITE_SELECT,
        orderBy: [{ archived: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: window.skip,
        take: window.take,
      }),
      this.db.site.count({ where }),
    ]);
    return toPage(rows, total, window);
  }

  findById(id: string, tx: Tx = this.db): Promise<SiteRow | null> {
    return tx.site.findUnique({ where: { id }, select: SITE_SELECT });
  }

  /** A non-archived site with this name key, other than `exceptId`. */
  findActiveByNameKey(
    nameKey: string,
    exceptId: string | undefined,
    tx: Tx,
  ): Promise<{ id: string } | null> {
    return tx.site.findFirst({
      where: { nameKey, archived: false, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
  }

  /**
   * Serialises name checks for one name key until the transaction ends, so two concurrent
   * saves of the same name can't both pass the "unique among non-archived" check.
   */
  async lockNameKey(nameKey: string, tx: Tx): Promise<void> {
    const lockKey = `site-name:${nameKey}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }

  create(
    data: SiteWrite & { name: string; nameKey: string },
    tx: Tx,
  ): Promise<SiteRow> {
    return tx.site.create({ data, select: SITE_SELECT });
  }

  update(id: string, data: SiteWrite, tx: Tx): Promise<SiteRow> {
    return tx.site.update({ where: { id }, data, select: SITE_SELECT });
  }

  async delete(id: string): Promise<void> {
    await this.db.site.delete({ where: { id } });
  }

  async countIssues(siteId: string): Promise<number> {
    return this.db.issue.count({ where: { siteId } });
  }

  /** Issue counts per site and status, and overdue counts per site, for `siteIds`. */
  async issueCounts(
    siteIds: string[],
    now: Date,
  ): Promise<{ byStatus: StatusCountRow[]; overdue: Map<string, number> }> {
    if (siteIds.length === 0) return { byStatus: [], overdue: new Map() };
    const scope = { siteId: { in: siteIds } };
    const [byStatus, overdue] = await Promise.all([
      this.db.issue.groupBy({
        by: ['siteId', 'status'],
        where: scope,
        _count: { _all: true },
      }),
      this.db.issue.groupBy({
        by: ['siteId'],
        where: { ...scope, ...overdueIssueWhere(now) },
        _count: { _all: true },
      }),
    ]);
    return {
      byStatus: byStatus.map((row) => ({
        key: row.siteId,
        status: row.status,
        count: row._count._all,
      })),
      overdue: new Map(overdue.map((row) => [row.siteId, row._count._all])),
    };
  }
}
