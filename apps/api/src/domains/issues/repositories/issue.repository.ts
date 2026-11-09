import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type IssueStatus,
  type PhotoKind,
  type Priority,
} from '@prisma/client';
import type { Tx } from '../../../common/interfaces/transaction.interface';
import { DatabaseService } from '../../../database/database.service';

/** Everything an `Issue` response shows (contract), and nothing else. */
export const ISSUE_SELECT = {
  id: true,
  siteId: true,
  number: true,
  status: true,
  priority: true,
  description: true,
  location: true,
  estimatedDate: true,
  capturedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedAt: true,
  sentAt: true,
  solvedAt: true,
  site: { select: { id: true, name: true } },
  category: { select: { id: true, nameAr: true, nameEn: true, color: true } },
  worker: { select: { id: true, name: true, phone: true } },
  formerWorkerName: true,
  photos: {
    select: {
      id: true,
      kind: true,
      url: true,
      width: true,
      height: true,
      sortOrder: true,
      createdAt: true,
    },
    // `before` sorts ahead of `after` (enum order); the first before-photo is the cover.
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.IssueSelect;

export type IssueRow = Prisma.IssueGetPayload<{ select: typeof ISSUE_SELECT }>;

export const STATUS_CHANGE_SELECT = {
  id: true,
  from: true,
  to: true,
  note: true,
  createdAt: true,
} satisfies Prisma.StatusChangeSelect;

export type StatusChangeRow = Prisma.StatusChangeGetPayload<{
  select: typeof STATUS_CHANGE_SELECT;
}>;

/** What the issues CSV reads from an issue's history. */
const ISSUE_CHANGE_SELECT = {
  issueId: true,
  to: true,
  note: true,
  createdAt: true,
} satisfies Prisma.StatusChangeSelect;

export type IssueChangeRow = Prisma.StatusChangeGetPayload<{
  select: typeof ISSUE_CHANGE_SELECT;
}>;

/** One line of the status-history CSV. */
const HISTORY_EXPORT_SELECT = {
  ...STATUS_CHANGE_SELECT,
  issue: { select: { number: true, site: { select: { name: true } } } },
} satisfies Prisma.StatusChangeSelect;

export type HistoryExportRow = Prisma.StatusChangeGetPayload<{
  select: typeof HISTORY_EXPORT_SELECT;
}>;

/** The rule-bearing columns of an issue, read under its row lock before a change. */
export const ISSUE_STATE_SELECT = {
  id: true,
  status: true,
  categoryId: true,
  description: true,
  workerId: true,
  formerWorkerName: true,
  estimatedDate: true,
  assignedAt: true,
  sentAt: true,
  solvedAt: true,
} satisfies Prisma.IssueSelect;

export type IssueStateRow = Prisma.IssueGetPayload<{
  select: typeof ISSUE_STATE_SELECT;
}>;

export interface NewPhoto {
  id: string;
  issueId: string;
  kind: PhotoKind;
  storageKey: string;
  url: string;
  width: number;
  height: number;
  sortOrder: number;
}

/** Every Prisma call of the issues domain: issues, their photos and status history. */
@Injectable()
export class IssueRepository {
  constructor(private readonly db: DatabaseService) {}

  /** A unique-key clash (e.g. the same client id created twice at once). */
  static isDuplicateKey(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work, { timeout: 20_000, maxWait: 10_000 });
  }

  // ------------------------------------------------------------- reads

  findById(id: string, tx: Tx = this.db): Promise<IssueRow | null> {
    return tx.issue.findUnique({ where: { id }, select: ISSUE_SELECT });
  }

  findManyByIds(ids: string[], tx: Tx = this.db): Promise<IssueRow[]> {
    return tx.issue.findMany({
      where: { id: { in: ids } },
      select: ISSUE_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  findHistory(issueId: string): Promise<StatusChangeRow[]> {
    return this.db.statusChange.findMany({
      where: { issueId },
      select: STATUS_CHANGE_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findPage(
    where: Prisma.IssueWhereInput,
    orderBy: Prisma.IssueOrderByWithRelationInput[],
    skip: number,
    take: number,
  ): Promise<{ rows: IssueRow[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.db.issue.findMany({
        where,
        orderBy,
        skip,
        take,
        select: ISSUE_SELECT,
      }),
      this.db.issue.count({ where }),
    ]);
    return { rows, total };
  }

  /** One slice of the matching issues in list order (the CSV export reads them batch by batch). */
  findBatch(
    where: Prisma.IssueWhereInput,
    orderBy: Prisma.IssueOrderByWithRelationInput[],
    skip: number,
    take: number,
  ): Promise<IssueRow[]> {
    return this.db.issue.findMany({
      where,
      orderBy,
      skip,
      take,
      select: ISSUE_SELECT,
    });
  }

  /** Every status change of `issueIds`, newest first (last note and closing time per issue). */
  findChangesOf(issueIds: string[]): Promise<IssueChangeRow[]> {
    if (issueIds.length === 0) return Promise.resolve([]);
    return this.db.statusChange.findMany({
      where: { issueId: { in: issueIds } },
      select: ISSUE_CHANGE_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * One slice of the status changes of the issues matching `where` (history CSV), grouped by
   * site and issue number, oldest change first within an issue.
   */
  findHistoryBatch(
    where: Prisma.IssueWhereInput,
    skip: number,
    take: number,
  ): Promise<HistoryExportRow[]> {
    return this.db.statusChange.findMany({
      where: { issue: where },
      select: HISTORY_EXPORT_SELECT,
      orderBy: [
        { issue: { site: { name: 'asc' } } },
        { issue: { siteId: 'asc' } },
        { issue: { number: 'asc' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      skip,
      take,
    });
  }

  // ------------------------------------------------------------- locks

  /**
   * Locks the issues' rows until the transaction ends (in id order, so two bulk updates can't
   * deadlock) and returns their rule-bearing state. Missing ids are simply absent.
   */
  async lockStates(tx: Tx, ids: string[]): Promise<IssueStateRow[]> {
    if (ids.length === 0) return [];
    const sorted = [...new Set(ids)].sort();
    await tx.$queryRaw`
      SELECT id FROM issues
      WHERE id IN (${Prisma.join(sorted.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id
      FOR UPDATE`;
    return tx.issue.findMany({
      where: { id: { in: sorted } },
      select: ISSUE_STATE_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async lockState(tx: Tx, id: string): Promise<IssueStateRow | null> {
    const [row] = await this.lockStates(tx, [id]);
    return row ?? null;
  }

  // ------------------------------------------------------------- writes

  /**
   * Takes the site's next issue number: one atomic UPDATE … RETURNING, so concurrent creates
   * serialise on the site row and get different numbers. The counter only grows (never reused,
   * §6.12). `null` when the site doesn't exist.
   */
  async takeNextNumber(
    tx: Tx,
    siteId: string,
  ): Promise<{ number: number; archived: boolean } | null> {
    const rows = await tx.$queryRaw<{ number: number; archived: boolean }[]>`
      UPDATE sites
      SET next_number = next_number + 1, updated_at = now()
      WHERE id = ${siteId}::uuid
      RETURNING next_number - 1 AS number, archived`;
    return rows[0] ?? null;
  }

  async createIssue(
    tx: Tx,
    data: {
      id: string;
      siteId: string;
      number: number;
      status: IssueStatus;
      description: string | null;
      location: string | null;
      capturedAt: Date;
      categoryId: string | null;
      workerId: string | null;
      formerWorkerName: string | null;
      estimatedDate: Date | null;
      priority?: Priority;
      assignedAt?: Date;
    },
  ): Promise<void> {
    await tx.issue.create({ data });
  }

  async update(
    tx: Tx,
    id: string,
    data: Prisma.IssueUncheckedUpdateInput,
  ): Promise<void> {
    await tx.issue.update({ where: { id }, data });
  }

  async deleteIssue(tx: Tx, id: string): Promise<void> {
    await tx.issue.delete({ where: { id } });
  }

  /** Appends one status change (history is append-only: nothing here updates or deletes one). */
  async addStatusChange(
    tx: Tx,
    data: {
      issueId: string;
      from: IssueStatus | null;
      to: IssueStatus;
      note?: string | null;
    },
  ): Promise<void> {
    await tx.statusChange.create({ data });
  }

  // ------------------------------------------------------------- photos

  countPhotos(issueId: string, kind: PhotoKind, tx: Tx = this.db) {
    return tx.photo.count({ where: { issueId, kind } });
  }

  async nextPhotoSortOrder(
    tx: Tx,
    issueId: string,
    kind: PhotoKind,
  ): Promise<number> {
    const agg = await tx.photo.aggregate({
      where: { issueId, kind },
      _max: { sortOrder: true },
    });
    return (agg._max.sortOrder ?? -1) + 1;
  }

  async createPhoto(tx: Tx, data: NewPhoto): Promise<void> {
    await tx.photo.create({ data });
  }

  findPhoto(tx: Tx, issueId: string, photoId: string) {
    return tx.photo.findFirst({
      where: { id: photoId, issueId },
      select: { id: true, kind: true, storageKey: true },
    });
  }

  photoKeys(tx: Tx, issueId: string): Promise<{ storageKey: string }[]> {
    return tx.photo.findMany({
      where: { issueId },
      select: { storageKey: true },
    });
  }

  async deletePhoto(tx: Tx, photoId: string): Promise<void> {
    await tx.photo.delete({ where: { id: photoId } });
  }

  /** Moves every photo of `fromIssueId` to `toIssueId`, after the target's own of each kind. */
  async movePhotos(
    tx: Tx,
    fromIssueId: string,
    toIssueId: string,
  ): Promise<void> {
    for (const kind of ['before', 'after'] as const) {
      const offset = await this.nextPhotoSortOrder(tx, toIssueId, kind);
      await tx.photo.updateMany({
        where: { issueId: fromIssueId, kind },
        data: { issueId: toIssueId, sortOrder: { increment: offset } },
      });
    }
  }
}
