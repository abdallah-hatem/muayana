import { SITE_NAME_MAX } from '@muayana/shared';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Trim } from '../../../common/decorators/trim.decorator';
import { TRI_STATE, type TriState } from '../../../common/utils/tri-state.util';

/** Mirrors SiteListQuerySchema: archived sites are hidden unless asked for (business §3). */
export class SiteListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TRI_STATE)
  archived: TriState = 'false';

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(SITE_NAME_MAX)
  search?: string;
}
