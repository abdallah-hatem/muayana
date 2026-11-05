import { TriStateSchema } from '@muayana/shared';

/** `?archived=` / `?active=` values: `true | false | all`. */
export const TRI_STATE = TriStateSchema.options;
export type TriState = (typeof TRI_STATE)[number];

/** A tri-state filter as a Prisma boolean condition: `all` means no condition. */
export const triStateWhere = (value: TriState): boolean | undefined =>
  value === 'all' ? undefined : value === 'true';
