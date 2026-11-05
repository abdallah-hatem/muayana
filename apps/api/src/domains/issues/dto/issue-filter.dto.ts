import {
  ISSUE_STATUSES,
  IssueSortSchema,
  PRIORITIES,
  SEARCH_MAX,
  type IssueSort,
  type IssueStatus,
  type Priority,
} from '@muayana/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `a,b , c` → `['a','b','c']` (contract: status and priority are comma lists). */
export const commaList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    : value;

const boolFlag = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS requires any[] for a mixin's constructor
type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Mirrors IssueFilterSchema (@muayana/shared): the issues list and both CSV exports take it, and
 * buildIssueWhere (common/utils/issue-filter.util.ts) turns it into the query.
 */
export function WithIssueFilter<TBase extends Constructor>(Base: TBase) {
  class IssueFilterFields extends Base {
    @IsOptional()
    @IsUUID()
    siteId?: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @IsOptional()
    @IsUUID()
    workerId?: string;

    @IsOptional()
    @Transform(commaList)
    @ArrayMinSize(1)
    @IsIn(ISSUE_STATUSES, { each: true })
    status?: IssueStatus[];

    @IsOptional()
    @Transform(commaList)
    @ArrayMinSize(1)
    @IsIn(PRIORITIES, { each: true })
    priority?: Priority[];

    @IsOptional()
    @Transform(boolFlag)
    @IsBoolean()
    overdue?: boolean;

    @IsOptional()
    @Matches(DATE_ONLY)
    @IsISO8601({ strict: true })
    capturedFrom?: string;

    @IsOptional()
    @Matches(DATE_ONLY)
    @IsISO8601({ strict: true })
    capturedTo?: string;

    @IsOptional()
    @Matches(DATE_ONLY)
    @IsISO8601({ strict: true })
    solvedFrom?: string;

    @IsOptional()
    @Matches(DATE_ONLY)
    @IsISO8601({ strict: true })
    solvedTo?: string;

    @IsOptional()
    @Transform(trimmed)
    @IsString()
    @MaxLength(SEARCH_MAX)
    q?: string;

    @IsOptional()
    @IsIn(IssueSortSchema.options)
    sort: IssueSort = 'newest';
  }
  return IssueFilterFields;
}

/** The filter alone (the CSV exports). */
export class IssueFilterDto extends WithIssueFilter(class {}) {}

/** `GET /issues`: the filter plus `page` / `limit` (limit max 100). */
export class IssueListQueryDto extends WithIssueFilter(PaginationQueryDto) {}
