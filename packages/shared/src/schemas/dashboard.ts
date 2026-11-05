import { z } from 'zod';
import { CategoryRefSchema } from './categories';
import { IssueStatusSchema } from './enums';
import { SiteRefSchema } from './sites';
import { WorkerRefSchema } from './workers';

export const DashboardQuerySchema = z.object({ siteId: z.uuid().optional() });

export const DashboardSchema = z.object({
  byStatus: z.record(IssueStatusSchema, z.number().int()),
  overdue: z.number().int(),
  inbox: z.number().int(),
  byCategory: z.array(
    z.object({
      category: CategoryRefSchema,
      open: z.number().int(),
      overdue: z.number().int(),
    }),
  ),
  byWorker: z.array(
    z.object({
      worker: WorkerRefSchema,
      open: z.number().int(),
      overdue: z.number().int(),
    }),
  ),
  bySite: z.array(
    z.object({
      site: SiteRefSchema,
      open: z.number().int(),
      new: z.number().int(),
      overdue: z.number().int(),
    }),
  ),
});
