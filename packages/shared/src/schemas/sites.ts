import { z } from 'zod';
import { PaginationQuerySchema, TriStateSchema } from './common';

export const SITE_NAME_MAX = 120;
export const SITE_ADDRESS_MAX = 240;
export const SITE_NOTES_MAX = 2000;

export const SiteCountsSchema = z.object({
  open: z.number().int(),
  new: z.number().int(),
  overdue: z.number().int(),
  total: z.number().int(),
});

export const SiteSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.string(),
  nextNumber: z.number().int(),
  counts: SiteCountsSchema,
});

/** `{ id, name }` — how an issue names its site. */
export const SiteRefSchema = z.object({ id: z.uuid(), name: z.string() });

export const SiteListQuerySchema = PaginationQuerySchema.extend({
  archived: TriStateSchema.default('false'),
  search: z.string().trim().max(SITE_NAME_MAX).optional(),
});

export const CreateSiteRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(SITE_NAME_MAX),
  address: z.string().trim().max(SITE_ADDRESS_MAX).optional(),
  notes: z.string().trim().max(SITE_NOTES_MAX).optional(),
});

export const UpdateSiteRequestSchema = CreateSiteRequestSchema.partial().extend(
  { archived: z.boolean().optional() },
);
