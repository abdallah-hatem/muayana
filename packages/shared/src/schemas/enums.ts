import { z } from 'zod';

/**
 * Enums from the API contract ("Enums"). The zod schema is the single source; the TypeScript
 * type and the value map are derived from it. The Prisma enums mirror these and
 * apps/api/src/database/schema-enums.spec.ts fails if they drift.
 */

/** Lifecycle order (docs/business/04-statuses.md). */
export const IssueStatusSchema = z.enum([
  'new',
  'unassigned',
  'assigned',
  'sent',
  'estimated',
  'in_progress',
  'solved',
  'cancelled',
]);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;
export const IssueStatus = IssueStatusSchema.enum;
export const ISSUE_STATUSES = IssueStatusSchema.options;

export const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type Priority = z.infer<typeof PrioritySchema>;
export const Priority = PrioritySchema.enum;
export const PRIORITIES = PrioritySchema.options;

export const PhotoKindSchema = z.enum(['before', 'after']);
export type PhotoKind = z.infer<typeof PhotoKindSchema>;
export const PhotoKind = PhotoKindSchema.enum;

export const LocaleSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;
export const LOCALES = LocaleSchema.options;
export const DEFAULT_LOCALE: Locale = 'ar';

/** Writing direction of a locale. */
export const directionOf = (locale: Locale): 'rtl' | 'ltr' =>
  locale === 'ar' ? 'rtl' : 'ltr';

/** Sort orders of the issues list. */
export const IssueSortSchema = z.enum(['newest', 'oldest', 'priority', 'estimate']);
export type IssueSort = z.infer<typeof IssueSortSchema>;
