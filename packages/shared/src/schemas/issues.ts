import { z } from 'zod';
import {
  BoolQuerySchema,
  CommaListSchema,
  DateOnlySchema,
  InstantSchema,
  PaginationQuerySchema,
} from './common';
import { CategoryRefSchema } from './categories';
import {
  IssueSortSchema,
  IssueStatusSchema,
  PhotoKindSchema,
  PrioritySchema,
} from './enums';
import { SiteRefSchema } from './sites';
import { WorkerRefSchema } from './workers';

export const ISSUE_DESCRIPTION_MAX = 2000;
export const ISSUE_LOCATION_MAX = 240;
export const STATUS_NOTE_MAX = 1000;
/** Before-photos and after-photos each (business §3). */
export const PHOTOS_PER_KIND_MAX = 10;
/** Upload cap per photo (contract: jpeg/png/webp ≤ 4 MB). */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
/** Long side of a compressed photo (business §3). */
export const PHOTO_MAX_DIMENSION = 1600;
export const BULK_IDS_MAX = 200;
export const SEARCH_MAX = 120;

export const PhotoSchema = z.object({
  id: z.uuid(),
  kind: PhotoKindSchema,
  url: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});

export const StatusChangeSchema = z.object({
  id: z.uuid(),
  from: IssueStatusSchema.nullable(),
  to: IssueStatusSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
});

export const IssueSchema = z.object({
  id: z.uuid(),
  siteId: z.uuid(),
  site: SiteRefSchema,
  number: z.number().int(),
  status: IssueStatusSchema,
  priority: PrioritySchema,
  description: z.string().nullable(),
  location: z.string().nullable(),
  category: CategoryRefSchema.nullable(),
  worker: WorkerRefSchema.nullable(),
  /** `YYYY-MM-DD` */
  estimatedDate: z.string().nullable(),
  capturedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assignedAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  solvedAt: z.string().nullable(),
  overdue: z.boolean(),
  photos: z.array(PhotoSchema),
});

export const IssueDetailSchema = IssueSchema.extend({
  history: z.array(StatusChangeSchema),
});

/** The issues list filter (contract `IssueFilter`), shared by the list and the CSV exports. */
export const IssueFilterSchema = z.object({
  siteId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  workerId: z.uuid().optional(),
  status: CommaListSchema.pipe(z.array(IssueStatusSchema).min(1)).optional(),
  priority: CommaListSchema.pipe(z.array(PrioritySchema).min(1)).optional(),
  overdue: BoolQuerySchema.optional(),
  capturedFrom: DateOnlySchema.optional(),
  capturedTo: DateOnlySchema.optional(),
  solvedFrom: DateOnlySchema.optional(),
  solvedTo: DateOnlySchema.optional(),
  q: z.string().trim().max(SEARCH_MAX).optional(),
  sort: IssueSortSchema.default('newest'),
});

export const IssueListQuerySchema = IssueFilterSchema.extend(
  PaginationQuerySchema.shape,
);

/** Multipart fields of `POST /issues` (the `photo` file travels beside them). */
export const CreateIssueRequestSchema = z.strictObject({
  id: z.uuid(),
  siteId: z.uuid(),
  capturedAt: InstantSchema,
  description: z.string().trim().max(ISSUE_DESCRIPTION_MAX).optional(),
  location: z.string().trim().max(ISSUE_LOCATION_MAX).optional(),
  /** Trade, contractor and priority from the capture sheet (§5.1): the §4 rules decide the status. */
  categoryId: z.uuid().optional(),
  workerId: z.uuid().optional(),
  priority: PrioritySchema.optional(),
});

/** Multipart fields of `POST /issues/:id/photos`. */
export const AddPhotoRequestSchema = z.strictObject({ kind: PhotoKindSchema });

export const UpdateIssueRequestSchema = z.strictObject({
  description: z.string().trim().max(ISSUE_DESCRIPTION_MAX).optional(),
  location: z.string().trim().max(ISSUE_LOCATION_MAX).optional(),
  priority: PrioritySchema.optional(),
  /** null is accepted so the API can refuse it with 409 on a sorted issue (§6.1). */
  categoryId: z.uuid().nullable().optional(),
  /** null removes the worker. */
  workerId: z.uuid().nullable().optional(),
  /** null clears the date. */
  estimatedDate: DateOnlySchema.nullable().optional(),
});

export const ChangeStatusRequestSchema = z.strictObject({
  status: IssueStatusSchema,
  note: z.string().trim().max(STATUS_NOTE_MAX).optional(),
  estimatedDate: DateOnlySchema.optional(),
});

export const BulkIssuesRequestSchema = z.strictObject({
  ids: z.array(z.uuid()).min(1).max(BULK_IDS_MAX),
  categoryId: z.uuid().optional(),
  status: IssueStatusSchema.optional(),
  workerId: z.uuid().optional(),
  note: z.string().trim().max(STATUS_NOTE_MAX).optional(),
});

export const BulkIssuesResponseSchema = z.object({
  updated: z.number().int(),
  issues: z.array(IssueSchema),
});

export const MergeIssuesRequestSchema = z.strictObject({ sourceId: z.uuid() });
