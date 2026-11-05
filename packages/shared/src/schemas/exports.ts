import { z } from 'zod';
import { CommaListSchema } from './common';
import { LocaleSchema } from './enums';
import { IssueFilterSchema } from './issues';
import { WorkerListQuerySchema } from './workers';

/** Columns of the issues CSV, in their default order (business §7). */
export const IssueExportColumnSchema = z.enum([
  'number',
  'site',
  'status',
  'category',
  'worker',
  'workerPhone',
  'priority',
  'description',
  'location',
  'capturedAt',
  'assignedAt',
  'sentAt',
  'estimatedDate',
  'solvedAt',
  'overdue',
  'daysOpen',
  'photoLinks',
  'afterPhotoLinks',
  'lastNote',
]);
export type IssueExportColumn = z.infer<typeof IssueExportColumnSchema>;
export const ISSUE_EXPORT_COLUMNS = IssueExportColumnSchema.options;

/** `GET /issues/export.csv` — the list filter + chosen columns (default all) + header language. */
export const IssueExportQuerySchema = IssueFilterSchema.extend({
  columns: CommaListSchema.pipe(z.array(IssueExportColumnSchema).min(1)).optional(),
  lang: LocaleSchema.default('ar'),
});

/** `GET /issues/history.csv`. */
export const IssueHistoryExportQuerySchema = IssueFilterSchema.extend({
  lang: LocaleSchema.default('ar'),
});

/** `GET /workers/export.csv` — the workers filter without paging. */
export const WorkerExportQuerySchema = WorkerListQuerySchema.omit({
  page: true,
  limit: true,
}).extend({ lang: LocaleSchema.default('ar') });
