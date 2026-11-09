import { z } from 'zod';
import { PaginationQuerySchema, TriStateSchema } from './common';
import { CategoryRefSchema } from './categories';

export const WORKER_NAME_MAX = 120;
export const WORKER_NOTES_MAX = 2000;
/** A phone as typed (local 010…, +20…, spaces); the API normalises it to +20… (rules: T3). */
export const PHONE_INPUT_MAX = 40;

export const WorkerCountsSchema = z.object({
  assigned: z.number().int(),
  sent: z.number().int(),
  estimated: z.number().int(),
  in_progress: z.number().int(),
  solved: z.number().int(),
  cancelled: z.number().int(),
  open: z.number().int(),
  overdue: z.number().int(),
});

export const WorkerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  notes: z.string().nullable(),
  active: z.boolean(),
  categories: z.array(CategoryRefSchema),
  counts: WorkerCountsSchema,
});

/** `{ id, name, phone }` — how an issue names its worker. */
export const WorkerRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
});

export const WorkerListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(WORKER_NAME_MAX).optional(),
  categoryId: z.uuid().optional(),
  active: TriStateSchema.default('true'),
});

export const CreateWorkerRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(WORKER_NAME_MAX),
  phone: z.string().trim().min(1).max(PHONE_INPUT_MAX),
  categoryIds: z.array(z.uuid()).min(1),
  notes: z.string().trim().max(WORKER_NOTES_MAX).optional(),
});

export const UpdateWorkerRequestSchema =
  CreateWorkerRequestSchema.partial().extend({
    active: z.boolean().optional(),
  });
