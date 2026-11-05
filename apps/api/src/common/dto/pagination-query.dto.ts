import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from '@muayana/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * `?page=1&limit=20` (contract header: default 20, max 100). Out-of-range values are a 400, not silently
 * clamped; the cap matches BaseRepository's PAGE_LIMIT_MAX. List DTOs extend this.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
}
