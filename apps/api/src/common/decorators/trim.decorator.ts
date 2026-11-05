import { Transform } from 'class-transformer';

/** Trims a string body/query field before validation; other values pass through untouched. */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
