import { randomUUID } from 'node:crypto';
import {
  nameKey,
  todayInCairo,
  type IssueStatus,
} from '@muayana/shared';
import type { DatabaseService } from '../../src/database/database.service';

/**
 * Empties every business table (issues and what hangs off them, workers, sites, categories),
 * so each test starts from nothing. Users stay: the engineer's token keeps working.
 */
export async function resetDomainData(db: DatabaseService): Promise<void> {
  await db.$transaction([
    db.statusChange.deleteMany(),
    db.photo.deleteMany(),
    db.issue.deleteMany(),
    db.workerCategory.deleteMany(),
    db.worker.deleteMany(),
    db.site.deleteMany(),
    db.category.deleteMany(),
  ]);
}

/** `YYYY-MM-DD` that many days from today in Cairo (negative = in the past). */
export function cairoDate(now: Date, days: number): string {
  const day = new Date(`${todayInCairo(now)}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export async function makeSite(
  db: DatabaseService,
  name = `Site ${randomUUID().slice(0, 8)}`,
  archived = false,
) {
  return db.site.create({
    data: { name, nameKey: nameKey(name), archived },
  });
}

export async function makeCategory(
  db: DatabaseService,
  nameAr = `فئة ${randomUUID().slice(0, 8)}`,
  { active = true, sortOrder = 0 } = {},
) {
  return db.category.create({
    data: {
      nameAr,
      nameKey: nameKey(nameAr),
      color: '#336699',
      active,
      sortOrder,
    },
  });
}

let phoneSeq = 0;

/** A worker with a unique valid phone (+2010xxxxxxxx). */
export async function makeWorker(
  db: DatabaseService,
  categoryIds: string[],
  { name = `Worker ${phoneSeq + 1}`, active = true } = {},
) {
  const phone = `+2010${String(++phoneSeq).padStart(8, '0')}`;
  return db.worker.create({
    data: {
      name,
      phone,
      active,
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
}

/** An issue straight in the database (the issues API is another task's). */
export async function makeIssue(
  db: DatabaseService,
  data: {
    siteId: string;
    status?: IssueStatus;
    categoryId?: string | null;
    workerId?: string | null;
    estimatedDate?: string | null;
  },
) {
  const site = await db.site.update({
    where: { id: data.siteId },
    data: { nextNumber: { increment: 1 } },
  });
  return db.issue.create({
    data: {
      id: randomUUID(),
      siteId: data.siteId,
      number: site.nextNumber - 1,
      status: data.status ?? 'new',
      description: data.status && data.status !== 'new' ? 'A defect' : null,
      categoryId: data.categoryId ?? null,
      workerId: data.workerId ?? null,
      estimatedDate: data.estimatedDate
        ? new Date(`${data.estimatedDate}T00:00:00.000Z`)
        : null,
      capturedAt: new Date(),
    },
  });
}
