import { z } from 'zod';
import { HexColorSchema } from './common';

export const CATEGORY_NAME_MAX = 60;
/** Categories are not paginated: small and bounded (contract: max 100). */
export const CATEGORY_MAX_COUNT = 100;

export const CategoryRefSchema = z.object({
  id: z.uuid(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  color: z.string(),
});

export const CategorySchema = CategoryRefSchema.extend({
  sortOrder: z.number().int(),
  active: z.boolean(),
  counts: z.object({ open: z.number().int(), workers: z.number().int() }),
});

export const CategoryListQuerySchema = z.object({
  active: z.enum(['true', 'all']).default('true'),
});

export const CreateCategoryRequestSchema = z.strictObject({
  nameAr: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
  nameEn: z.string().trim().max(CATEGORY_NAME_MAX).optional(),
  color: HexColorSchema,
});

export const UpdateCategoryRequestSchema =
  CreateCategoryRequestSchema.partial().extend({
    active: z.boolean().optional(),
  });

/** All category ids, in the new order. */
export const ReorderCategoriesRequestSchema = z.strictObject({
  ids: z.array(z.uuid()).min(1).max(CATEGORY_MAX_COUNT),
});
