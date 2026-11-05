import { Inject, Injectable } from '@nestjs/common';
import type { Dashboard } from '@muayana/shared';
import type { Prisma } from '@prisma/client';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { summarize } from './dashboard.pure';
import type { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardRepository } from './repositories/dashboard.repository';

/**
 * The dashboard (business §5.9): counts over every active site, or one site. Archived sites are
 * left out everywhere — their issues stay in the issues list and the exports.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(query: DashboardQueryDto): Promise<Dashboard> {
    const scope: Prisma.IssueWhereInput = {
      site: { archived: false },
      ...(query.siteId && { siteId: query.siteId }),
    };
    const { groups, overdue } = await this.repo.issueGroups(
      scope,
      this.clock.now(),
    );
    const summary = summarize(groups, overdue);
    const [categories, workers, sites] = await Promise.all([
      this.repo.categories([...summary.byCategory.keys()]),
      this.repo.workers([...summary.byWorker.keys()]),
      this.repo.activeSites(query.siteId),
    ]);
    const none = { open: 0, overdue: 0 };
    return {
      byStatus: summary.byStatus,
      overdue: summary.overdue,
      inbox: summary.inbox,
      byCategory: categories.map((category) => ({
        category,
        ...(summary.byCategory.get(category.id) ?? none),
      })),
      byWorker: workers.map((worker) => ({
        worker,
        ...(summary.byWorker.get(worker.id) ?? none),
      })),
      // Every active site in scope, even with nothing open (the web names the chosen one).
      bySite: sites.map((site) => ({
        site,
        ...(summary.bySite.get(site.id) ?? { ...none, new: 0 }),
      })),
    };
  }
}
