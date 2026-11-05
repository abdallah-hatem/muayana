import { z } from 'zod';
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from './envelope';

export const UuidSchema = z.uuid();

/** `YYYY-MM-DD` (estimatedDate and date filters). */
export const DateOnlySchema = z.iso.date();

/** An ISO 8601 instant (`capturedAt`, timestamps). */
export const InstantSchema = z.iso.datetime({ offset: true });

/** `#RRGGBB` (category colours). */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be #RRGGBB');

/** `?page&limit` — default 20, max 100 (contract header). */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_LIMIT_MAX)
    .default(PAGE_LIMIT_DEFAULT),
});

/** `true|false|all` filters (archived, active). */
export const TriStateSchema = z.enum(['true', 'false', 'all']);

/** A boolean query flag sent as a string. */
export const BoolQuerySchema = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

/** A comma list in the query string (`status=new,assigned`), split and trimmed. */
export const CommaListSchema = z.string().transform((value) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean),
);

/** `{ id }` — the answer of every DELETE. */
export const DeletedSchema = z.object({ id: UuidSchema });

/**
 * Comparison key for names unique "ignoring case and surrounding spaces" (site name, category
 * nameAr): trimmed, inner whitespace collapsed, lower-cased. Stored in `name_key` columns.
 */
export const nameKey = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();
