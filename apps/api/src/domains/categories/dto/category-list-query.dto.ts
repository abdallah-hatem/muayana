import { IsIn, IsOptional } from 'class-validator';

/** Mirrors CategoryListQuerySchema: active ones only unless `all` (business §3). */
export class CategoryListQueryDto {
  @IsOptional()
  @IsIn(['true', 'all'])
  active: 'true' | 'all' = 'true';
}
