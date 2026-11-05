import { Injectable } from '@nestjs/common';
import type { Tx } from '../../../common/interfaces/transaction.interface';
import { DatabaseService } from '../../../database/database.service';

export interface WorkerFacts {
  id: string;
  active: boolean;
  categoryIds: string[];
}

/**
 * The facts the issue rules need about the rows an issue points at (site archived, category
 * and worker active, a worker's categories). Read-only; the sites, categories and workers
 * domains own those tables.
 */
@Injectable()
export class IssueRefsRepository {
  constructor(private readonly db: DatabaseService) {}

  findSite(id: string): Promise<{ id: string; archived: boolean } | null> {
    return this.db.site.findUnique({
      where: { id },
      select: { id: true, archived: true },
    });
  }

  findCategory(
    id: string,
    tx: Tx = this.db,
  ): Promise<{ id: string; active: boolean } | null> {
    return tx.category.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
  }

  async findWorker(id: string, tx: Tx = this.db): Promise<WorkerFacts | null> {
    const row = await tx.worker.findUnique({
      where: { id },
      select: {
        id: true,
        active: true,
        categories: { select: { categoryId: true } },
      },
    });
    return row
      ? {
          id: row.id,
          active: row.active,
          categoryIds: row.categories.map((c) => c.categoryId),
        }
      : null;
  }

  /** Workers by id, for a bulk update that touches several issues' workers. */
  async findWorkers(
    ids: string[],
    tx: Tx = this.db,
  ): Promise<Map<string, WorkerFacts>> {
    if (ids.length === 0) return new Map();
    const rows = await tx.worker.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: {
        id: true,
        active: true,
        categories: { select: { categoryId: true } },
      },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          active: row.active,
          categoryIds: row.categories.map((c) => c.categoryId),
        },
      ]),
    );
  }
}
