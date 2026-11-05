import { CATEGORY_MAX_COUNT } from '@muayana/shared';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** Mirrors ReorderCategoriesRequestSchema: every category id, in the new order. */
export class ReorderCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CATEGORY_MAX_COUNT)
  @IsUUID('all', { each: true })
  ids: string[];
}
