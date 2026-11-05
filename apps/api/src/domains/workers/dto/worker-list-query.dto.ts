import { IntersectionType } from '@nestjs/mapped-types';
import { WORKER_NAME_MAX } from '@muayana/shared';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CsvLangDto } from '../../../common/dto/csv-lang.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Trim } from '../../../common/decorators/trim.decorator';
import { TRI_STATE, type TriState } from '../../../common/utils/tri-state.util';

/** The workers filter (business §5.7), shared by the list and the CSV. */
export class WorkerFilterDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(WORKER_NAME_MAX)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(TRI_STATE)
  active: TriState = 'true';
}

/** Mirrors WorkerListQuerySchema. */
export class WorkerListQueryDto extends IntersectionType(
  PaginationQueryDto,
  WorkerFilterDto,
) {}

/** Mirrors WorkerExportQuerySchema: the filter without paging, plus the header language. */
export class WorkerExportQueryDto extends IntersectionType(
  WorkerFilterDto,
  CsvLangDto,
) {}
