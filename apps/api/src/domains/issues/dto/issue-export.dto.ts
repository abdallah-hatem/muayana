import { IntersectionType } from '@nestjs/mapped-types';
import { ISSUE_EXPORT_COLUMNS, type IssueExportColumn } from '@muayana/shared';
import { Transform } from 'class-transformer';
import { ArrayMinSize, IsIn, IsOptional } from 'class-validator';
import { CsvLangDto } from '../../../common/dto/csv-lang.dto';
import { IssueFilterDto, commaList } from './issue-filter.dto';

/** Mirrors IssueHistoryExportQuerySchema: the list filter + the header language. */
export class IssueHistoryExportQueryDto extends IntersectionType(
  IssueFilterDto,
  CsvLangDto,
) {}

/**
 * Mirrors IssueExportQuerySchema: plus `columns`, a comma list of §7 columns written in the
 * order given (default: all, in §7 order). An unknown column is a 400.
 */
export class IssueExportQueryDto extends IssueHistoryExportQueryDto {
  @IsOptional()
  @Transform(commaList)
  @ArrayMinSize(1)
  @IsIn(ISSUE_EXPORT_COLUMNS, { each: true })
  columns?: IssueExportColumn[];
}
