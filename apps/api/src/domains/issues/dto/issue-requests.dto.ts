import {
  BULK_IDS_MAX,
  ISSUE_DESCRIPTION_MAX,
  ISSUE_LOCATION_MAX,
  ISSUE_STATUSES,
  PRIORITIES,
  STATUS_NOTE_MAX,
  type IssueStatus,
  type PhotoKind,
  type Priority,
} from '@muayana/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/*
 * Request bodies of the issues routes. Each mirrors its zod schema in
 * packages/shared/src/schemas/issues.ts.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Multipart fields of `POST /issues` (CreateIssueRequestSchema); the file is `photo`. */
export class CreateIssueDto {
  @IsUUID()
  id: string;

  @IsUUID()
  siteId: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  capturedAt: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(ISSUE_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(ISSUE_LOCATION_MAX)
  location?: string;

  /** The trade chosen in the capture sheet; with a description it sorts the issue (§5.1). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** The contractor chosen in the capture sheet; needs the trade and a description (§5.1). */
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: Priority;
}

/** Multipart fields of `POST /issues/:id/photos` (AddPhotoRequestSchema). */
export class AddPhotoDto {
  @IsIn(['before', 'after'])
  kind: PhotoKind;
}

/**
 * `PATCH /issues/:id` (UpdateIssueRequestSchema). `null` clears a field. `categoryId: null` and
 * a blank description are accepted by the transport so the rule (applyPatch) refuses them
 * outside `new` with ISSUE_REQUIREMENTS, as the plan's edge cases expect.
 */
export class UpdateIssueDto {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(ISSUE_DESCRIPTION_MAX)
  description?: string | null;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(ISSUE_LOCATION_MAX)
  location?: string | null;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: Priority;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  workerId?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  estimatedDate?: string | null;
}

/** `POST /issues/:id/status` (ChangeStatusRequestSchema). */
export class ChangeStatusDto {
  @IsIn(ISSUE_STATUSES)
  status: IssueStatus;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(STATUS_NOTE_MAX)
  note?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  estimatedDate?: string;
}

/** `POST /issues/bulk` (BulkIssuesRequestSchema): one change applied to 1–200 issues. */
export class BulkIssuesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_IDS_MAX)
  @IsUUID('all', { each: true })
  ids: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(ISSUE_STATUSES)
  status?: IssueStatus;

  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(STATUS_NOTE_MAX)
  note?: string;
}

/** `POST /issues/:id/merge` (MergeIssuesRequestSchema). */
export class MergeIssuesDto {
  @IsUUID()
  sourceId: string;
}
